node -e '
const fs=require("fs");let bad=0;
const COLOR=/^(bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|divide|fill|stroke|accent|caret|decoration|placeholder)-(.+)$/;
const GRAY=/^((gray|slate)-\d+|white|black|transparent|current|inherit)$/;
const NONCOLOR=/^(\d+|px|xs|sm|base|lg|\d?xl|[xytrblse]|[xytrblse]-(\d+|px|reverse)|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|solid|dashed|dotted|double|wavy|none|hidden|collapse|separate|inset|fixed|local|scroll|auto|cover|contain|top|bottom|(left|right)-(top|bottom)|repeat(-x|-y|-round|-space)?|no-repeat|offset-\d+|from-font|(clip|origin|blend)-.+)$/;
const BANNED=/^(shadow|bg-gradient|bg-linear|bg-radial|bg-conic|from|via|to)(-|$)/;
const PAINT=/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|color)\(/g;
for(const f of process.argv.slice(1)){fs.readFileSync(f,"utf8").split("\n").forEach((line,i)=>{
  const hit=m=>{bad++;console.log(f+":"+(i+1)+": "+m)};
  (line.match(/<svg|<img|material-icons|\bfa-[a-z]/g)||[]).forEach(hit);
  for(const m of line.matchAll(/style\s*=\s*(?:(["\x27`])(.*?)\1|\{\{(.*?)\}\})|[\w-]*(?:color|background|border|fill|stroke|shadow|outline)[\w-]*\s*:\s*[^;"\x27}]*/gi))
    (m[0].match(PAINT)||[]).forEach(hit);
  for(const m of line.matchAll(/class(?:Name)?\s*[=:]\s*(["\x27`])(.*?)\1/g))
    for(let t of m[2].split(/\s+/)){t=t.replace(/^!/,"").split(":").pop().replace(/\/\d+$/,"");if(!t)continue;
      if(BANNED.test(t)){hit(t);continue}
      const c=t.match(COLOR);if(!c)continue;const v=c[2];
      if(GRAY.test(v)||NONCOLOR.test(v))continue;
      if(/^\[/.test(v)&&!/#|rgb|hsl|oklch|color|var\(/.test(v))continue;
      hit(t)}
})}
process.exit(bad?1:0)' "$@"
