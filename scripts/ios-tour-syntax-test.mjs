import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAst} from 'rollup/parseAst';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function checkSteps(file){
 const ast=parseAst(readFileSync(new URL(file,import.meta.url),'utf8'));let checked=0;
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='VariableDeclarator'&&n.id?.name==='HELPERS'&&n.init?.type==='TemplateLiteral'&&!n.init.expressions.length){new AsyncFunction(n.init.quasis[0].value.cooked);checked++;}
  if(n.type==='CallExpression'&&n.callee?.name==='step'&&n.arguments[1]?.type==='TemplateLiteral'&&!n.arguments[1].expressions.length){new AsyncFunction(n.arguments[1].quasis[0].value.cooked);checked++;}
  for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(typeof v==='object')walk(v);}
 walk(ast);return checked;
}
test('iPhone tour injected scripts compile after template escaping',()=>{
 assert(checkSteps('./ios-tour.mjs')>20);
});
test('iPhone cover probe injected scripts compile after template escaping',()=>{
 assert(checkSteps('./ios-cover-probe.mjs')>=10);
});
