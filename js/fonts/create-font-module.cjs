const fs = require('fs');
const path = require('path');

const fontDir = path.join(__dirname, '../../Montserrat/static');
const fonts = [
    { name: 'MontserratBlack', file: 'Montserrat-Black.ttf' },
    { name: 'MontserratBold', file: 'Montserrat-Bold.ttf' },
    { name: 'MontserratSemiBold', file: 'Montserrat-SemiBold.ttf' },
    { name: 'MontserratRegular', file: 'Montserrat-Regular.ttf' }
];

let output = '/**\n';
output += ' * Montserrat Font Data for jsPDF\n';
output += ' * Base64 encoded TTF fonts\n';
output += ' */\n\n';

fonts.forEach(font => {
    const fontPath = path.join(fontDir, font.file);
    const fontData = fs.readFileSync(fontPath);
    const base64 = fontData.toString('base64');
    output += 'export const ' + font.name + ' = "' + base64 + '";\n\n';
});

fs.writeFileSync(path.join(__dirname, 'montserrat-fonts.js'), output);
console.log('Font module created successfully');
console.log('File size:', fs.statSync(path.join(__dirname, 'montserrat-fonts.js')).size, 'bytes');
