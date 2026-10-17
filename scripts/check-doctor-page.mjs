import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
const html=readFileSync('index.html','utf8');
const match=html.match(/<script[^>]*>([\\s\\S]*?)<\\/script>/i);
assert.ok(match,'inline behavior script is required');
new Script(match[1],{filename:'doctor-inline.js'});
assert.match(html,/واجهة تجريبية — بيانات العيادة والطبيب افتراضية/);
assert.match(html,/هذا ليس حجزًا مؤكدًا/);
for(const claim of ['+12','4.9/5','6 أيام','★★★★★','د. أمين المرابط','د. سلمى الإدريسي','+212 522 00 00 00']) {
  assert.ok(!html.includes(claim),'unverified clinic claim remains: '+claim);
}
assert.match(html,/غير مرتبط بطبيب حقيقي/);
assert.match(html,/بيانات التواصل غير مفعلة/);
console.log('Doctor prototype disclosure and JavaScript checks passed');
