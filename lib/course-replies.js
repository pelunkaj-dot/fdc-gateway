const groups=require('./course-response-groups.json');
const numberWords=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
function normalizeReply(text){
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'")
    .replace(/\b(i'm|it's|let's|i'd|we're|don't|can't|she's|he's)\b/g,w=>({"i'm":"i am","it's":"it is","let's":"let us","i'd":"i would","we're":"we are","don't":"do not","can't":"cannot","she's":"she is","he's":"he is"}[w]))
    .replace(/\b(?:10|[0-9])\b/g,n=>numberWords[Number(n)]).replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
}
function chooseCourseReference(group,expected,transcript){
  const answers=Object.hasOwn(groups,group)?groups[group]:null;
  if(!answers||!answers.includes(expected))return null;
  return answers.find(answer=>normalizeReply(answer)===normalizeReply(transcript))||expected;
}
module.exports={normalizeReply,chooseCourseReference};
