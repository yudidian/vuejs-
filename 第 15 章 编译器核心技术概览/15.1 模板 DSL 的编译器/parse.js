function parse(template) {

}
function transform(templateAST) {

}
const template = `
<div>
<h1 v-if="ok">Vue Template</h1>
</div>
`
const templateAST = parse(template)
const jsAST = transform(templateAST)
