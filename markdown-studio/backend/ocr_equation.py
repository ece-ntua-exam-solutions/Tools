"""Optional pix2tex OCR with inspectable regions and output anomaly warnings.

Region detection is a layout heuristic, not equation recognition. Never infer
mathematical correctness or a confidence probability from these checks.
"""
from __future__ import annotations
import base64
import importlib.util
import io
import math
import re
import statistics
import threading
import warnings
from collections import Counter

_MODEL = None
_LOCK = threading.Lock()
MAX_REGIONS = 24


def status():
    return {
        'available': importlib.util.find_spec('pix2tex') is not None,
        'loaded': _MODEL is not None, 'engine': 'pix2tex', 'local': True,
        'region_analysis': True, 'multiline': True,
    }


def decode_image(encoded):
    from PIL import Image, ImageOps
    if not isinstance(encoded, str) or len(encoded) > 11_200_000:
        raise ValueError('Η εικόνα πρέπει να είναι έως 8 MB.')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError('Μη έγκυρα δεδομένα εικόνας.') from exc
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError('Η εικόνα πρέπει να είναι έως 8 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            im = Image.open(io.BytesIO(raw))
            if im.format not in ('PNG', 'JPEG', 'WEBP'):
                raise ValueError('Υποστηρίζονται PNG, JPEG και WebP.')
            if im.width * im.height > 16_000_000:
                raise ValueError('Η εικόνα ξεπερνά τα 16 megapixel. Επίλεξε μικρότερη περιοχή.')
            im.load()
            im = ImageOps.exif_transpose(im)
            if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
                rgba = im.convert('RGBA')
                white = Image.new('RGBA', rgba.size, 'white')
                white.alpha_composite(rgba)
                im = white.convert('RGB')
            else:
                im = im.convert('RGB')
            # Preserve original geometry until after region selection.
            return im
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('Δεν διαβάστηκε η εικόνα. Δώσε έγκυρο PNG/JPEG/WebP.') from exc


def checked_rect(rect):
    if not isinstance(rect, (list, tuple)) or len(rect) != 4:
        raise ValueError('Μη έγκυρη περιοχή εικόνας.')
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in rect):
        raise ValueError('Μη έγκυρες συντεταγμένες εικόνας.')
    x0, y0, x1, y1 = map(float, rect)
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        raise ValueError('Η περιοχή πρέπει να βρίσκεται μέσα στην εικόνα.')
    return [x0, y0, x1, y1]


def pixels(im, rect):
    a, b, c, d = checked_rect(rect)
    return (int(a * im.width), int(b * im.height), max(int(c * im.width), int(a * im.width) + 1), max(int(d * im.height), int(b * im.height) + 1))


def grayscale(im):
    from PIL import ImageOps
    gray = ImageOps.grayscale(im)
    # Detect dark background from border samples. No fixed binary threshold is
    # applied to the model input; preserve antialiasing and faint details.
    w, h = gray.size
    samples = [gray.getpixel((x, y)) for x in (0, w // 2, w - 1) for y in (0, h - 1)]
    if statistics.median(samples) < 110:
        gray = ImageOps.invert(gray)
    return ImageOps.autocontrast(gray, cutoff=0)


def ink_mask(im):
    gray = grayscale(im)
    return gray.point(lambda p: 255 if p < 180 else 0)


def detect_regions(im, payload):
    mode = payload.get('layout', 'auto')
    if mode not in ('auto', 'single', 'lines'):
        raise ValueError('Επίλεξε αυτόματο εντοπισμό, μία εξίσωση ή γραμμές.')
    crop = checked_rect(payload.get('crop') or [0, 0, 1, 1])
    left, top, right, bottom = pixels(im, crop)
    part = im.crop((left, top, right, bottom))
    mask = ink_mask(part)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError('Δεν εντοπίστηκε κείμενο στην επιλεγμένη περιοχή.')
    bands = []
    for y in range(mask.height):
        # A row maximum avoids a Python loop through every pixel.
        hist = mask.crop((0, y, mask.width, y + 1)).histogram()
        if hist[255] >= max(2, mask.width // 1200):
            if not bands or y > bands[-1][1] + 1:
                bands.append([y, y])
            else:
                bands[-1][1] = y
    heights = [b - a + 1 for a, b in bands if b - a + 1 >= 3]
    default_gap = max(3, min(14, round(statistics.median(heights or [10]) * .5)))
    supplied_gap = payload.get('line_gap')
    if supplied_gap in (None, ''):
        gap = default_gap
    else:
        try:
            gap = int(supplied_gap)
        except (ValueError, TypeError):
            raise ValueError('Το κενό γραμμών πρέπει να είναι 1–40 pixel.')
        if not 1 <= gap <= 40:
            raise ValueError('Το κενό γραμμών πρέπει να είναι 1–40 pixel.')
    groups = []
    for a, b in bands:
        if groups and a - groups[-1][1] - 1 <= gap:
            groups[-1][1] = b
        else:
            groups.append([a, b])
    if mode == 'single' or len(groups) <= 1:
        groups = [[bbox[1], bbox[3] - 1]]
    if len(groups) > MAX_REGIONS:
        raise ValueError(f'Εντοπίστηκαν περισσότερες από {MAX_REGIONS} γραμμές. Επίλεξε μικρότερη περιοχή ή άλλαξε το κενό γραμμών.')
    regions = []
    for index, (a, b) in enumerate(groups):
        local_bbox = mask.crop((0, a, mask.width, b + 1)).getbbox()
        if local_bbox is None:
            continue
        x0, x1 = max(0, local_bbox[0] - 3), min(mask.width, local_bbox[2] + 3)
        y0, y1 = max(0, a - 2), min(mask.height, b + 3)
        regions.append({'index': index, 'rect': [(left + x0) / im.width, (top + y0) / im.height, (left + x1) / im.width, (top + y1) / im.height]})
    notices = []
    if len(regions) > 1:
        notices.append('Ελέγξτε τα πλαίσια πριν από την αναγνώριση. Κάθε πλαίσιο πρέπει να περιέχει ολόκληρη εξίσωση, μαζί με αριθμητή και παρονομαστή.')
    return {'regions': regions, 'line_count': len(regions), 'layout_used': 'lines' if len(regions) > 1 else 'single', 'line_gap': gap, 'warnings': notices, 'width': im.width, 'height': im.height}


def analyze(payload):
    return detect_regions(decode_image(payload.get('image', '')), payload)


def prepare(im):
    from PIL import ImageOps
    gray = grayscale(im)
    bbox = ink_mask(gray).getbbox()
    if bbox is None:
        raise ValueError('Κενή περιοχή εικόνας.')
    gray = gray.crop(bbox)
    gray.thumbnail((2000, 1200))
    return ImageOps.expand(gray, border=12, fill=255).convert('RGB')


def quality_flags(value):
    flags = []
    if not value.strip():
        return ['empty']
    if len(value) > 12000:
        flags.append('excessive_output')
    text = re.sub(r'\\[A-Za-z]+', '', value)
    atoms = re.findall(r'[A-Za-z0-9]', text)
    counts = Counter(atoms)
    if len(atoms) >= 18 and counts.get('1', 0) / len(atoms) >= .6:
        flags.append('repeated_ones')
    elif len(atoms) >= 24 and max(counts.values(), default=0) / len(atoms) > .8:
        flags.append('repeated_symbol')
    if len(re.findall(r'\\frac\s*\{\s*1\s*\}\s*\{\s*1\s*\}', value)) >= 5:
        flags.append('repeated_unit_fractions')
    depth = 0
    for char in re.sub(r'\\[{}]', '', value):
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
        if depth < 0:
            break
    if depth != 0:
        flags.append('unbalanced_braces')
    return flags


def combine_lines(lines):
    if len(lines) == 1:
        return lines[0]
    aligned = []
    for line in lines:
        if not line:
            line = r'\text{[OCR: missing line]}'
        # Only a presentation anchor, no algebraic simplification or inference.
        aligned.append(line.replace('=', '&=', 1) if '=' in line and '&' not in line else line)
    return '\\begin{aligned}\n' + ' \\\\\n'.join(aligned) + '\n\\end{aligned}'


def _predict(model, image, resize):
    # pix2tex 0.1.4 supports resize=False. Prevent its convenience clipboard
    # side effect: copying in the Studio remains an explicit frontend action.
    import sys
    module = sys.modules.get('pix2tex.cli')
    clipboard = getattr(module, 'clipboard', None)
    original_copy = getattr(clipboard, 'copy', None)
    if original_copy:
        clipboard.copy = lambda value: None
    try:
        return str(model(image, resize=resize)).strip()
    finally:
        if original_copy:
            clipboard.copy = original_copy


def recognize(payload):
    global _MODEL
    if payload.get('allow_model') is not True:
        raise ValueError('Επίλεξε φόρτωση μοντέλου πριν από την αναγνώριση.')
    image = decode_image(payload.get('image', ''))
    planned = payload.get('regions')
    if planned is not None:
        if not isinstance(planned, list) or not 1 <= len(planned) <= MAX_REGIONS:
            raise ValueError(f'Επίλεξε 1–{MAX_REGIONS} γραμμές.')
        rects = [checked_rect(r) for r in planned]
    else:
        rects = [r['rect'] for r in detect_regions(image, payload)['regions']]
    if not status()['available']:
        raise ValueError('Το pix2tex δεν έχει εγκατασταθεί. Στο Conda environment: python -m pip install -r requirements-ocr.txt. Μετά επανεκκίνησε τον server.')
    if not _LOCK.acquire(blocking=False):
        raise ValueError('Γίνεται ήδη αναγνώριση εικόνας. Δοκίμασε ξανά όταν ολοκληρωθεί.')
    try:
        if _MODEL is None:
            try:
                from pix2tex.cli import LatexOCR
                _MODEL = LatexOCR()
            except Exception as exc:
                raise RuntimeError('Αποτυχία φόρτωσης pix2tex. Έλεγξε εγκατάσταση και πρώτη λήψη βαρών: ' + str(exc)[:350]) from exc
        args = getattr(_MODEL, 'args', None)
        if args is not None:
            args.temperature = .15
        results = []
        for i, rect in enumerate(rects):
            try:
                prepared = prepare(image.crop(pixels(image, rect)))
                first = _predict(_MODEL, prepared, resize=payload.get('resize', True) is not False)
                candidates = [{'latex': first, 'flags': quality_flags(first), 'resize': payload.get('resize', True) is not False}]
                if candidates[0]['flags'] and payload.get('retry', True) is not False:
                    try:
                        retry = _predict(_MODEL, prepared, resize=not candidates[0]['resize'])
                        candidates.append({'latex': retry, 'flags': quality_flags(retry), 'resize': not candidates[0]['resize']})
                    except Exception as exc:
                        candidates[0]['retry_error'] = str(exc)[:350]
                chosen = min(candidates, key=lambda c: len(c['flags']))
                results.append({'index': i, 'rect': rect, **chosen, 'alternatives': candidates})
            except Exception as exc:
                results.append({'index': i, 'rect': rect, 'latex': '', 'flags': ['recognition_error'], 'error': str(exc)[:350], 'alternatives': []})
        flags = [f'Γραμμή {r["index"] + 1}: {", ".join(r["flags"])}' for r in results if r['flags']]
        if not any(r['latex'] for r in results):
            raise RuntimeError('Απέτυχε η αναγνώριση όλων των περιοχών. ' + next((r.get('error', '') for r in results if r.get('error')), 'Δοκίμασε μία καθαρή εξίσωση.'))
        return {'latex': combine_lines([r['latex'] for r in results]), 'lines': results, 'engine': 'pix2tex', 'review_required': True, 'suspect': bool(flags), 'warnings': flags, 'quality_note': 'Οι έλεγχοι ανιχνεύουν ορισμένες ανωμαλίες, όχι μαθηματική ορθότητα ή πιθανότητα επιτυχίας.'}
    finally:
        _LOCK.release()
