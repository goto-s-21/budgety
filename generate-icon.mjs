import sharp from 'sharp';

const makeSvg = (size) => {
  const s = size / 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
  <g transform="scale(${s})">
    <rect x="6"  y="20" width="9" height="22" rx="2" fill="#d85c82"/>
    <rect x="19" y="12" width="9" height="30" rx="2" fill="#d85c82"/>
    <rect x="32" y="28" width="9" height="14" rx="2" fill="#d85c82"/>
  </g>
</svg>`;
};

await sharp(Buffer.from(makeSvg(512)), { density: 300 })
  .resize(512, 512).png().toFile('public/icon-512.png');
console.log('Generated public/icon-512.png');

await sharp(Buffer.from(makeSvg(192)), { density: 144 })
  .resize(192, 192).png().toFile('public/icon-192.png');
console.log('Generated public/icon-192.png');

await sharp(Buffer.from(makeSvg(180)), { density: 144 })
  .resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Generated public/apple-touch-icon.png');
