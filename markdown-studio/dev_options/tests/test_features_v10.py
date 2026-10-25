"""Meaningful offline checks. No email, GitHub mutation, or model download."""
from pathlib import Path
import sys,unittest,base64,io
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
import reports,ocr_equation
from PIL import Image
class Features(unittest.TestCase):
 def test_filters_apply_to_same_file(self):
  pr={'number':4,'title':'Δοκιμή','body':'Ελληνικά','html_url':'https://github.com/'+reports.REPO+'/pull/4','updated_at':'2026-10-25T12:00:00Z','user':{'login':'a'},'labels':[{'name':'review'}],'state':'open'}
  files=[{'filename':'1ο_Εξάμηνο/Γραμμική_Άλγεβρα/2024/ΚΑΝ/lysi.md'},{'filename':'2ο_Εξάμηνο/Φυσική/2025/ΚΑΝ/lysi.md'}]
  with patch.object(reports,'_pages',side_effect=lambda endpoint:[files] if '/files?' in endpoint else [[pr]]):
   self.assertEqual(len(reports.report({'course':'γραμμικη αλγεβρα','year':'2024','semester':'1'})['items']),1)
   self.assertEqual(len(reports.report({'course':'γραμμικη αλγεβρα','year':'2025'})['items']),0)
   self.assertEqual(reports.report({'drafts':False})['items'][0]['labels'],['review'])
 def test_ocr_decode_transparency_and_permissions(self):
  out=io.BytesIO();im=Image.new('RGBA',(80,30),(0,0,0,0));__import__('PIL.ImageDraw',fromlist=['Draw']).Draw(im).text((10,8),'x=1',fill=(0,0,0,255));im.save(out,format='PNG');image=base64.b64encode(out.getvalue()).decode()
  self.assertEqual(ocr_equation.decode_image(image).getpixel((0,0)),(255,255,255))
  with self.assertRaises(ValueError):ocr_equation.recognize({'image':image})
  with patch.object(ocr_equation,'status',return_value={'available':False}),self.assertRaisesRegex(ValueError,'pix2tex'):ocr_equation.recognize({'image':image,'allow_model':True})
 def test_ocr_mock_model_and_invalid_image(self):
  out=io.BytesIO();im=Image.new('RGB',(80,30),'white');__import__('PIL.ImageDraw',fromlist=['Draw']).Draw(im).text((10,8),'x=1',fill='black');im.save(out,format='PNG');image=base64.b64encode(out.getvalue()).decode()
  with patch.object(ocr_equation,'status',return_value={'available':True}),patch.object(ocr_equation,'_MODEL',lambda im,**kw:r'x=\frac{1}{2}'):
   self.assertEqual(ocr_equation.recognize({'image':image,'allow_model':True})['latex'],r'x=\frac{1}{2}')
  with self.assertRaises(ValueError):ocr_equation.decode_image('not base64')
 def test_merged_and_date_filters(self):
  pr={'number':5,'title':'merged','body':'','html_url':'https://github.com/'+reports.REPO+'/pull/5','updated_at':'2026-10-25T12:00:00Z','user':{'login':'a'},'labels':[],'state':'closed','merged_at':'2026-10-25T12:00:00Z'}
  with patch.object(reports,'_pages',side_effect=lambda endpoint:[[]] if '/files?' in endpoint else [[pr]]):
   self.assertEqual(len(reports.report({'state':'merged'})['items']),1)
   self.assertEqual(len(reports.report({'since':'2026-10-26'})['items']),0)
if __name__=='__main__':unittest.main()
