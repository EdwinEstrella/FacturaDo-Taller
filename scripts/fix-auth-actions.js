const fs = require('fs');
const path = require('path');

const actionsDir = path.join(__dirname, '..', 'actions');
const files = fs.readdirSync(actionsDir).filter(f => f.endsWith('.ts') && f !== 'auth-actions.ts');

for (const file of files) {
  const filePath = path.join(actionsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('requireAuth')) {
    content = content.replace(/(["']use server["'];?\s*)/, `$1\nimport { requireAuth } from "@/actions/auth-actions";\n`);
  }
  
  let newContent = '';
  let index = 0;
  
  while (true) {
    const fnIndex = content.indexOf('export async function ', index);
    if (fnIndex === -1) {
      newContent += content.slice(index);
      break;
    }
    
    const bracketIndex = content.indexOf('{', fnIndex);
    if (bracketIndex === -1) {
      newContent += content.slice(index);
      break;
    }
    
    newContent += content.slice(index, bracketIndex + 1);
    
    newContent += '\n    await requireAuth();\n';
    
    index = bracketIndex + 1;
  }
  
  fs.writeFileSync(filePath, newContent);
  console.log(`Modified ${file}`);
}
