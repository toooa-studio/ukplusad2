#!/usr/bin/env node

/**
 * Google Fonts ローカル自動化スクリプト
 * 
 * 使い方:
 *   node scripts/setup-fonts.js [vibe]
 * 
 * 例:
 *   node scripts/setup-fonts.js kawaii
 *   node scripts/setup-fonts.js elegant
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ANSI カラーコード
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${ step}] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

// YAMLファイルを読み込む
function loadConfig() {
  const configPath = path.join(rootDir, 'lib', 'fonts', 'fonts-config.yaml');
  
  if (!fs.existsSync(configPath)) {
    logError(`設定ファイルが見つかりません: ${configPath}`);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(configPath, 'utf8');
  return yaml.load(fileContent);
}

// ディレクトリを作成
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Google FontsからCSSを取得
function fetchGoogleFontsCSS(cssUrl, userAgent, accept) {
  logStep('1', `Google FontsからCSSを取得: ${cssUrl}`);
  
  const tempFile = path.join(rootDir, 'temp_google_fonts.css');
  
  try {
    execSync(
      `curl -s -L -H "User-Agent: ${userAgent}" -H "Accept: ${accept}" "${cssUrl}" -o "${tempFile}"`,
      { stdio: 'inherit' }
    );
    
    if (!fs.existsSync(tempFile) || fs.readFileSync(tempFile, 'utf8').trim() === '') {
      throw new Error('CSSファイルのダウンロードに失敗しました');
    }
    
    const cssContent = fs.readFileSync(tempFile, 'utf8');
    fs.unlinkSync(tempFile);
    
    logSuccess('CSSを取得しました');
    return cssContent;
  } catch (error) {
    logError(`CSS取得エラー: ${error.message}`);
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    throw error;
  }
}

// CSSからフォントファイルのURLを抽出
function extractFontUrls(cssContent) {
  logStep('2', 'フォントファイルのURLを抽出中...');
  
  // まず .woff2 を探す
  let urls = cssContent.match(/https:\/\/[^)]+\.woff2/g);
  
  if (!urls || urls.length === 0) {
    logWarning('.woff2 が見つかりません。.ttf を探します...');
    urls = cssContent.match(/https:\/\/[^)]+\.ttf/g);
  }
  
  if (!urls || urls.length === 0) {
    logError('フォントファイルのURLが見つかりませんでした');
    return [];
  }
  
  // 重複を削除
  urls = [...new Set(urls)];
  
  logSuccess(`${urls.length}個のフォントファイルを発見しました`);
  return urls;
}

// フォントファイルをダウンロード
function downloadFonts(urls, destDir, userAgent, referer) {
  logStep('3', `フォントファイルをダウンロード中... (${urls.length}個)`);
  
  ensureDir(destDir);
  
  const downloadedFiles = [];
  
  urls.forEach((url, index) => {
    const filename = `font-${index}${path.extname(url)}`;
    const destPath = path.join(destDir, filename);
    
    try {
      execSync(
        `curl -s -L --referer "${referer}" -H "User-Agent: ${userAgent}" "${url}" -o "${destPath}"`,
        { stdio: 'pipe' }
      );
      
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        logSuccess(`  ${filename} (${(fs.statSync(destPath).size / 1024).toFixed(1)}KB)`);
        downloadedFiles.push({ url, filename });
      } else {
        logWarning(`  ${filename} のダウンロードに失敗しました（スキップ）`);
      }
    } catch (error) {
      logWarning(`  ${filename} のダウンロードに失敗しました: ${error.message}`);
    }
  });
  
  return downloadedFiles;
}

// CSSのURLをローカルパスに書き換え
function rewriteCSSUrls(cssContent, urlMapping) {
  logStep('4', 'CSSのURLをローカルパスに書き換え中...');
  
  let rewrittenCSS = cssContent;
  
  urlMapping.forEach(({ url, filename }) => {
    rewrittenCSS = rewrittenCSS.replace(url, `./${filename}`);
  });
  
  logSuccess('URLを書き換えました');
  return rewrittenCSS;
}

// fonts.css を生成
function saveFontCSS(cssContent, destDir) {
  const cssPath = path.join(destDir, 'fonts.css');
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  logSuccess(`fonts.css を生成: ${cssPath}`);
}

// フォントセットを処理
function processFontSet(fontConfig, http, label) {
  log(`\n━━━ ${label}フォント: ${fontConfig.family} ━━━`, 'bright');
  
  // CSSを取得
  const cssContent = fetchGoogleFontsCSS(
    fontConfig.css,
    http.userAgent,
    http.accept
  );
  
  // URLを抽出
  const urls = extractFontUrls(cssContent);
  
  if (urls.length === 0) {
    logWarning(`${label}フォントのダウンロードをスキップします`);
    return null;
  }
  
  // ダウンロード
  const destDir = path.join(rootDir, fontConfig.destDir);
  const downloadedFiles = downloadFonts(urls, destDir, http.userAgent, http.referer);
  
  if (downloadedFiles.length === 0) {
    logWarning(`${label}フォントのファイルが1つもダウンロードできませんでした`);
    return null;
  }
  
  // CSSを書き換え
  const rewrittenCSS = rewriteCSSUrls(cssContent, downloadedFiles);
  
  // fonts.cssを保存
  saveFontCSS(rewrittenCSS, destDir);
  
  return {
    family: fontConfig.family,
    cssPath: path.relative(path.join(rootDir, 'lib', 'fonts'), destDir) + '/fonts.css',
  };
}

// _active.css を生成
function generateActiveCSS(displayInfo, bodyInfo, outputPath) {
  logStep('5', '_active.css を生成中...');
  
  const lines = [
    '/* Google Fonts - ローカル参照版 */',
    '/* このファイルは自動生成されます（scripts/setup-fonts.js） */',
    '',
  ];
  
  if (displayInfo) {
    lines.push(`/* 表示用フォント: ${displayInfo.family} */`);
    lines.push(`@import './${displayInfo.cssPath}';`);
    lines.push('');
  }
  
  if (bodyInfo) {
    lines.push(`/* 本文用フォント: ${bodyInfo.family} */`);
    lines.push(`@import './${bodyInfo.cssPath}';`);
  }
  
  const content = lines.join('\n');
  fs.writeFileSync(outputPath, content, 'utf8');
  
  logSuccess(`_active.css を生成: ${outputPath}`);
}

// _vars.css を生成
function generateVarsCSS(displayInfo, bodyInfo, outputPath, varNames) {
  logStep('6', '_vars.css を生成中...');
  
  const lines = [
    '/* CSS変数定義 - フォントファミリー */',
    '/* このファイルは自動生成されます（scripts/setup-fonts.js） */',
    '',
    ':root {',
  ];
  
  if (displayInfo) {
    lines.push(`  ${varNames.display}: "${displayInfo.family}", sans-serif;`);
  }
  
  if (bodyInfo) {
    lines.push(`  ${varNames.body}: "${bodyInfo.family}", sans-serif;`);
  }
  
  lines.push('}');
  
  const content = lines.join('\n');
  fs.writeFileSync(outputPath, content, 'utf8');
  
  logSuccess(`_vars.css を生成: ${outputPath}`);
}

// layout.tsx を更新
function updateLayout() {
  logStep('7', 'app/layout.tsx を更新中...');
  
  const layoutPath = path.join(rootDir, 'app', 'layout.tsx');
  
  if (!fs.existsSync(layoutPath)) {
    logWarning('app/layout.tsx が見つかりません（スキップ）');
    return;
  }
  
  let layoutContent = fs.readFileSync(layoutPath, 'utf8');
  const originalContent = layoutContent;
  
  // Geist フォントのimportを削除
  layoutContent = layoutContent.replace(/import\s+{\s*Geist[^}]*}\s+from\s+["']next\/font\/google["'];?\n?/g, '');
  
  // Geist フォントの定義を削除（複数行対応）
  layoutContent = layoutContent.replace(/const\s+geist\w+\s*=\s*Geist[^;]+;\s*\n?/g, '');
  layoutContent = layoutContent.replace(/const\s+geist\w+\s*=\s*Geist[^}]+}\);?\s*\n?/g, '');
  
  // 空行を整理
  layoutContent = layoutContent.replace(/\n\n\n+/g, '\n\n');
  
  // className から geist 変数を削除し、font-body クラスを追加
  layoutContent = layoutContent.replace(/className=\{`\$\{geist[^}]+\}\s*antialiased`\}/g, 'className="antialiased font-body"');
  layoutContent = layoutContent.replace(/className=\{`antialiased\s*\$\{geist[^}]+\}`\}/g, 'className="antialiased font-body"');
  layoutContent = layoutContent.replace(/className=\{`\$\{geist[^\}]+\}\s*\$\{geist[^\}]+\}\s*antialiased`\}/g, 'className="antialiased font-body"');
  
  // 既に font-body がない antialiased のみの場合も追加
  layoutContent = layoutContent.replace(/className="antialiased"(?![\s\S]*font-body)/g, 'className="antialiased font-body"');
  
  // フォントCSSのimportを追加（既に存在しない場合）
  if (!layoutContent.includes('../lib/fonts/_active.css')) {
    const importPosition = layoutContent.indexOf('import');
    if (importPosition !== -1) {
      layoutContent = 
        'import "../lib/fonts/_active.css";\n' +
        'import "../lib/fonts/_vars.css";\n' +
        layoutContent;
    }
  }
  
  if (layoutContent !== originalContent) {
    fs.writeFileSync(layoutPath, layoutContent, 'utf8');
    logSuccess('layout.tsx を更新しました');
  } else {
    logSuccess('layout.tsx は既に正しい状態です');
  }
}

// globals.css を更新
function updateGlobalCSS(displayInfo, bodyInfo) {
  logStep('8', 'app/globals.css を更新中...');
  
  const globalCSSPath = path.join(rootDir, 'app', 'globals.css');
  
  if (!fs.existsSync(globalCSSPath)) {
    logWarning('app/globals.css が見つかりません（スキップ）');
    return;
  }
  
  let cssContent = fs.readFileSync(globalCSSPath, 'utf8');
  const originalContent = cssContent;
  
  // 🚨 CRITICAL: フォントCSSの重複インポートを削除（複数ページ対応）
  // 理由: layout.tsx でのインポートがすべてのページに適用されるため、
  // globals.css での重複インポートは CSS 読み込み順序を不安定にする
  cssContent = cssContent.replace(/@import\s+["']\.\.\/lib\/fonts\/_active\.css["'];?\s*\n?/g, '');
  cssContent = cssContent.replace(/@import\s+["']\.\.\/lib\/fonts\/_vars\.css["'];?\s*\n?/g, '');
  
  // 🆕 CRITICAL: :root セクションを自動更新（複数ページでのフォント適用問題を解決）
  // globals.css の :root で CSS変数を直接定義することで、
  // Tailwind CSS v4 との互換性を保ち、読み込み順序の問題を解決
  const newRootSection = `:root {
  --font-display: "${displayInfo.family}", serif;
  --font-body: "${bodyInfo.family}", sans-serif;
}`;
  
  // 既存の :root セクションを検出・置換
  const rootPattern = /:root\s*\{[^}]*\}/s;
  
  if (rootPattern.test(cssContent)) {
    // 既存の :root を置換
    cssContent = cssContent.replace(rootPattern, newRootSection);
    logSuccess(':root セクションを更新しました');
  } else {
    // :root が存在しない場合は先頭に追加（@import より前に配置）
    cssContent = newRootSection + '\n\n' + cssContent;
    logSuccess(':root セクションを追加しました');
  }
  
  // @theme 定義が既に存在するか確認
  if (!cssContent.includes('@theme')) {
    // ファイル末尾に @theme を追加
    cssContent = cssContent.trim() + '\n\n@theme {\n  /* フォントファミリーの定義 */\n  --font-family-display: var(--font-display);\n  --font-family-body: var(--font-body);\n  --font-family-sans: var(--font-body);\n}\n';
  }
  
  if (cssContent !== originalContent) {
    fs.writeFileSync(globalCSSPath, cssContent, 'utf8');
    logSuccess('globals.css を更新しました');
  } else {
    logSuccess('globals.css は既に正しい状態です');
  }
}

// 引数を解析
function parseArgs() {
  const args = {
    vibe: null,
    display: null,
    body: null,
  };
  
  // 第1引数：雰囲気
  if (process.argv[2] && !process.argv[2].startsWith('--')) {
    args.vibe = process.argv[2];
  }
  
  // オプション引数を解析
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--display=')) {
      args.display = arg.split('=')[1];
    } else if (arg.startsWith('--body=')) {
      args.body = arg.split('=')[1];
    }
  });
  
  return args;
}

// メイン処理
function main() {
  log('\n╔════════════════════════════════════════╗', 'bright');
  log('║  Google Fonts ローカル自動化          ║', 'bright');
  log('╚════════════════════════════════════════╝', 'bright');
  
  // 引数を解析
  const args = parseArgs();
  
  // 設定ファイルを読み込む
  const config = loadConfig();
  
  // 雰囲気を決定
  const selectedVibe = args.vibe || config.defaults.vibe;
  
  if (!config.presets[selectedVibe]) {
    logError(`雰囲気 "${selectedVibe}" が見つかりません`);
    log('\n利用可能な雰囲気:', 'bright');
    Object.keys(config.presets).forEach(v => log(`  - ${v}`));
    process.exit(1);
  }
  
  log(`\n雰囲気: ${selectedVibe}`, 'bright');
  
  const preset = config.presets[selectedVibe];
  
  // 新形式（fonts.display/fonts.body）か旧形式（display/body）か判定
  const isNewFormat = preset.fonts !== undefined;
  
  let displayConfig, bodyConfig;
  
  if (isNewFormat) {
    // 新形式：複数選択肢対応
    const displayFonts = preset.fonts.display;
    const bodyFonts = preset.fonts.body;
    
    // 表示用フォントを選択
    if (args.display) {
      if (!displayFonts[args.display]) {
        logError(`表示用フォント "${args.display}" が見つかりません`);
        log('\n利用可能な表示用フォント:', 'bright');
        Object.keys(displayFonts).forEach(key => {
          log(`  - ${key}: ${displayFonts[key].name}`);
        });
        process.exit(1);
      }
      displayConfig = displayFonts[args.display];
    } else {
      // デフォルト（最初の選択肢）
      const firstDisplayKey = Object.keys(displayFonts)[0];
      displayConfig = displayFonts[firstDisplayKey];
    }
    
    // 本文用フォントを選択
    if (args.body) {
      if (!bodyFonts[args.body]) {
        logError(`本文用フォント "${args.body}" が見つかりません`);
        log('\n利用可能な本文用フォント:', 'bright');
        Object.keys(bodyFonts).forEach(key => {
          log(`  - ${key}: ${bodyFonts[key].name}`);
        });
        process.exit(1);
      }
      bodyConfig = bodyFonts[args.body];
    } else {
      // デフォルト（最初の選択肢）
      const firstBodyKey = Object.keys(bodyFonts)[0];
      bodyConfig = bodyFonts[firstBodyKey];
    }
  } else {
    // 旧形式：後方互換性のため
    displayConfig = preset.display;
    bodyConfig = preset.body;
  }
  
  // 表示用フォントを処理
  const displayInfo = processFontSet(displayConfig, config.defaults.http, '表示用');
  
  // 本文用フォントを処理
  const bodyInfo = processFontSet(bodyConfig, config.defaults.http, '本文用');
  
  // _active.css を生成
  const activeCssPath = path.join(rootDir, config.defaults.outputs.activeCss);
  generateActiveCSS(displayInfo, bodyInfo, activeCssPath);
  
  // _vars.css を生成
  const varsCssPath = path.join(rootDir, config.defaults.outputs.varsCss);
  generateVarsCSS(displayInfo, bodyInfo, varsCssPath, config.defaults.variables);
  
  // layout.tsx を更新
  updateLayout();
  
  // globals.css を更新（フォント情報を渡す）
  updateGlobalCSS(displayInfo, bodyInfo);
  
  log('\n╔════════════════════════════════════════╗', 'green');
  log('║  ✓ セットアップ完了！                 ║', 'green');
  log('╚════════════════════════════════════════╝', 'green');
  
  log('\n設定内容:', 'bright');
  log(`  見出しフォント: ${displayInfo.family}`, 'cyan');
  log(`  本文フォント: ${bodyInfo.family}`, 'cyan');
  
  log('\n📋 次のステップ（重要）:', 'bright');
  log('  1. 開発サーバーを再起動してください:', 'yellow');
  log('     • ターミナルで Ctrl+C を押してサーバーを停止', 'yellow');
  log('     • npm run dev で再起動', 'yellow');
  log('', 'reset');
  log('  2. ブラウザでハードリロードしてください:', 'yellow');
  log('     • Mac: Cmd + Shift + R', 'yellow');
  log('     • Windows/Linux: Ctrl + Shift + F5', 'yellow');
  log('', 'reset');
  log('  3. 開発者ツールでフォントを確認:', 'cyan');
  log('     • F12 → Elements → body要素 → Computed → font-family', 'cyan');
  log('', 'reset');
  
  log('💡 ヒント: フォントが反映されない場合は、memories/font_workflow.yaml の', 'blue');
  log('   トラブルシューティングセクション（issue_4）を参照してください\n', 'blue');
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  logError(`予期しないエラー: ${error.message}`);
  process.exit(1);
});

// 実行
main();

