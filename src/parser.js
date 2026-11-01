export function parseCourse(text, filename='') {
 text=text.replace(/\u0000/g,'').replace(/\r/g,'');
 const code=(text.match(/\b(CSE|MATH|STAT|[A-Z]{2,6})\s+(\d{3})\b/)||filename.match(/([A-Z]+)\s*(\d{3})/));
 if(!code) throw Error('Could not identify a course code.');
 const course={code:`${code[1]} ${code[2]}`,term:(text.match(/WINTER\s+2027/i)||['Imported schedule'])[0],sections:[]};
 const re=/(?:^|\n)\s*([A-Z]{1,2})\s*\n\s*(Lecture|Quiz|Lab)\b([\s\S]*?)(?=\n\s*[A-Z]{1,2}\s*\n\s*(?:Lecture|Quiz|Lab)\b|$)/g;
 for(const m of text.matchAll(re)) {
  const body=m[3], time=body.match(/\b([MTWThF]+)\s*\n\s*(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/);
  const sln=body.match(/\b\d{5}\b/), loc=time?body.slice(time.index+time[0].length).match(/^\s*([A-Z]{2,4})\s+(\d{2,3}[A-Z]?)\b/):null;
  const minutes=(s,a)=>{let [h,n]=s.split(':').map(Number);return (h%12+(a==='PM'?12:0))*60+n;};
  const async=!time&&/Asynchronous|ASYNCHRONOUS/.test(body);
  if(!time&&!async) throw Error(`${course.code} ${m[1]} has an unresolved meeting time. Review the source before importing.`);
  course.sections.push({id:m[1],type:m[2],parent:m[2]==='Lecture'?null:m[1][0],sln:sln?.[0]||'',building:loc?.[1]||'',room:loc?.[2]||'',async,days:time?[...time[1].matchAll(/Th|M|T|W|F/g)].map(d=>({M:0,T:1,W:2,Th:3,F:4})[d[0]]):[],start:time?minutes(time[2],time[3]):null,end:time?minutes(time[4],time[5]):null});
 }
 if(!course.sections.length) throw Error('No sections recognized. Use a UW MyPlan course PDF with a section table.');
 if(course.sections.some(s=>s.parent&&!course.sections.some(l=>l.id===s.parent&&l.type==='Lecture')))throw Error('A linked lecture is missing from this file.');
 return course;
}
