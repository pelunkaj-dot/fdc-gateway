const {test}=require('node:test'),assert=require('node:assert/strict');
const {chooseCourseReference,normalizeReply}=require('../lib/course-replies');
test('British dialogue accepts reviewed different wording without accepting a different preference',()=>{
  assert.equal(chooseCourseReference('animals:like-dog','I like dogs.','My favourite animal is a dog.'),'My favourite animal is a dog.');
  assert.equal(chooseCourseReference('animals:like-dog','I like dogs.','I like cats.'),'I like dogs.');
  assert.equal(chooseCourseReference('food:want-water','Can I have some water, please?','Some water, please.'),'Some water, please.');
  assert.equal(chooseCourseReference('numbers:please-3','Three apples, please.','3 apples please'),'Three apples, please.');
});
test('Contractions, case, accents and punctuation normalize while word order and meaning remain exact',()=>{
  assert.equal(normalizeReply("I'm tired."),normalizeReply('I am tired.'));
  assert.equal(normalizeReply("Let's go by bus."),normalizeReply('Let us go by bus.'));
  assert.notEqual(normalizeReply('I like dogs.'),normalizeReply('Dogs like me.'));
  assert.equal(chooseCourseReference('weather:today-rain','It is raining.',"It's raining."),'It is raining.');
});
test('Unknown groups, inherited properties and references outside the reviewed group are rejected',()=>{
  for(const group of ['unknown','__proto__','constructor'])assert.equal(chooseCourseReference(group,'I like dogs.','I like dogs.'),null);
  assert.equal(chooseCourseReference('animals:like-dog','I like cats.','I like cats.'),null);
});
