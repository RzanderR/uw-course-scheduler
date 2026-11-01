import {readFileSync,writeFileSync} from 'node:fs';
import {parseCourse} from '../src/parser.js';
const courses=['CSE123','MATH126','STAT311'].map(n=>parseCourse(readFileSync(`scripts/${n}.txt`,'utf8'),n));
writeFileSync('src/courses.json',JSON.stringify(courses,null,2));
console.log(courses.map(c=>`${c.code}: ${c.sections.length} sections`).join('\n'));
