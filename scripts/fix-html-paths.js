const fs = require('fs');
const path = require('path');

// Function to fix HTML paths
function fixHtmlPaths() {
  const htmlPath = path.join(__dirname, '../.webpack/renderer/main_window/index.html');
  
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Replace absolute paths with relative paths
    html = html.replace(/src="\/main_window\//g, 'src="./');
    html = html.replace(/href="\/main_window\//g, 'href="./');
    
    fs.writeFileSync(htmlPath, html);
    console.log('Fixed HTML paths in:', htmlPath);
  } else {
    console.log('HTML file not found:', htmlPath);
  }
}

// Run the fix
fixHtmlPaths();
