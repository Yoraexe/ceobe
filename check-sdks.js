const { execSync } = require('child_process');

const sdks = [
  { name: 'Node.js', command: 'node -v' },
  { name: 'Bun', command: 'bun -v' },
  { name: 'Python', command: 'python --version' },
  { name: 'Git', command: 'git --version' },
  { name: 'Docker', command: 'docker --version' },
  { name: 'Rust (cargo)', command: 'cargo --version' },
  { name: 'Java JDK', command: 'java -version' },
  { name: 'Flutter', command: 'flutter --version' }
];

console.log('--- CEOBE SYSTEM DIAGNOSTIC ---');
console.log('Checking installed SDKs on the host machine...\n');

let results = [];

for (const sdk of sdks) {
  try {
    const output = execSync(sdk.command, { stdio: 'pipe' }).toString().trim();
    // For java -version which outputs to stderr sometimes:
    const versionLine = output.split('\\n')[0];
    results.push({ name: sdk.name, installed: true, version: versionLine });
  } catch (err) {
    // If it fails, that means the command isn't found or returned an error code
    results.push({ name: sdk.name, installed: false, version: 'NOT FOUND' });
  }
}

// Special check for Android SDK path typically found in env variables
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (androidHome) {
  results.push({ name: 'Android SDK', installed: true, version: \`Found at \${androidHome}\` });
} else {
  results.push({ name: 'Android SDK', installed: false, version: 'NOT FOUND (Check ANDROID_HOME)' });
}

results.forEach(r => {
  if (r.installed) {
    console.log(\`✅ \${r.name}: \${r.version}\`);
  } else {
    console.log(\`❌ \${r.name}: \${r.version}\`);
  }
});

console.log('\n--- DIAGNOSTIC COMPLETE ---');
