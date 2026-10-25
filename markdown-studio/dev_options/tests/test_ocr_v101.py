from pathlib import Path
import sys,base64,io,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
from PIL import Image,ImageDraw
import ocr_equation as o

BAD=r'\begin{array}{l}'+r'\frac{1}{1}\mathrm{I}^{1}'*12+r'\end{array}'
def sample():
 im=Image.new('RGB',(240,100),'white');d=ImageDraw.Draw(im)
 d.text((20,13),'x - 1',fill='black');d.line((17,28,65,28),fill='black',width=1);d.text((34,31),'2',fill='black');d.text((95,23),'= x + 1',fill='black');d.text((20,65),'x = -2',fill='black')
 b=io.BytesIO();im.save(b,format='PNG');return base64.b64encode(b.getvalue()).decode()

class OCRTests(unittest.TestCase):
 def test_fractions_stay_together(self):
  p=o.analyze({'image':sample(),'layout':'auto'})
  self.assertEqual(p['line_count'],2)
  first=p['regions'][0]['rect'];self.assertLess(first[1],.2);self.assertGreater(first[3],.38)
  self.assertEqual(o.analyze({'image':sample(),'layout':'single'})['line_count'],1)
  self.assertEqual(o.analyze({'image':sample(),'crop':[0,0,1,.55]})['line_count'],1)
 def test_bad_rects_and_empty_image(self):
  for r in [[0,0,2,1],[0,0,float('nan'),1],[.5,0,.1,1]]:
   with self.assertRaises(ValueError):o.checked_rect(r)
  im=Image.new('RGB',(30,30),'white');b=io.BytesIO();im.save(b,format='PNG')
  with self.assertRaisesRegex(ValueError,'κείμενο'):o.analyze({'image':base64.b64encode(b.getvalue()).decode()})
 def test_repetition_and_braces(self):
  self.assertIn('repeated_ones',o.quality_flags(BAD));self.assertIn('repeated_unit_fractions',o.quality_flags(BAD))
  self.assertEqual(o.quality_flags(r'\frac{x-1}{2}-\frac{2x+1}{6}=x+1'),[])
  self.assertIn('unbalanced_braces',o.quality_flags(r'\frac{x}{2'))
 def test_multiline_calls_are_separate(self):
  calls=[]
  def model(im,resize=True):calls.append(im.size);return ['x=1','y=2'][len(calls)-1]
  with patch.object(o,'status',return_value={'available':True}),patch.object(o,'_MODEL',model):
   data=o.recognize({'image':sample(),'allow_model':True})
  self.assertEqual(len(calls),2);self.assertEqual(len(data['lines']),2);self.assertIn('\\begin{aligned}',data['latex']);self.assertIn(' \\\\\n',data['latex']);self.assertFalse(data['suspect'])
 def test_retry_without_resizer(self):
  calls=[]
  def model(im,resize=True):calls.append(resize);return BAD if resize else 'x=-2'
  with patch.object(o,'status',return_value={'available':True}),patch.object(o,'_MODEL',model):
   data=o.recognize({'image':sample(),'allow_model':True,'layout':'single'})
  self.assertEqual(calls,[True,False]);self.assertEqual(data['latex'],'x=-2');self.assertFalse(data['suspect'])
 def test_suspect_kept_when_retry_disabled(self):
  with patch.object(o,'status',return_value={'available':True}),patch.object(o,'_MODEL',lambda im,**kw:BAD):
   data=o.recognize({'image':sample(),'allow_model':True,'layout':'single','retry':False})
  self.assertTrue(data['suspect']);self.assertTrue(data['warnings']);self.assertNotIn('confidence',data)
 def test_retry_failure_retains_first_result(self):
  def model(im,resize=True):
   if not resize:raise RuntimeError('mock retry error')
   return BAD
  with patch.object(o,'status',return_value={'available':True}),patch.object(o,'_MODEL',model):
   data=o.recognize({'image':sample(),'allow_model':True,'layout':'single'})
  self.assertEqual(data['latex'],BAD);self.assertTrue(data['suspect'])

if __name__=='__main__':unittest.main()
