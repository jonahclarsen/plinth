import {readFileSync,writeFileSync} from 'node:fs'
function failed(report){
 const failures=[]
 function visit(suite){
  for(const spec of suite.specs||[])for(const test of spec.tests)if(!['expected','skipped'].includes(test.status))failures.push(`${spec.file}: ${spec.title}`)
  for(const child of suite.suites||[])visit(child)
 }
 for(const suite of report.suites)visit(suite)
 if(report.errors?.length)throw Error(JSON.stringify(report.errors))
 return failures.sort()
}
const baseline=JSON.parse(readFileSync('.local/hover-results/baseline-tests.json','utf8'))
const fixed=JSON.parse(readFileSync('test-results/results.json','utf8'))
const inherited=failed(baseline),current=failed(fixed),added=current.filter(name=>!inherited.includes(name))
const result={baseline:baseline.stats,fixed:fixed.stats,inherited,current,added}
writeFileSync('.local/hover-results/test-comparison.json',JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
for(const name of current.filter(name=>inherited.includes(name)))console.log(`::warning::Existing baseline test failure: ${name}`)
if(added.length)throw Error(`New test failures: ${added.join('; ')}`)
