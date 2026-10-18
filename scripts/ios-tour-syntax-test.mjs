import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAst} from 'rollup/parseAst';
test('iPhone tour injected scripts compile after template escaping',()=>{
 const ast=parseAst(readFileSync(new URL('./ios-tour.mjs',import.meta.url),'utf8'));
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;let checked=0;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee?.name==='step'&&n.arguments[1]?.type==='TemplateLiteral'&&!n.arguments[1].expressions.length){new AsyncFunction(n.arguments[1].quasis[0].value.cooked);checked++;}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(typeof v==='object')walk(v);}
 walk(ast);assert(checked>20);
});
