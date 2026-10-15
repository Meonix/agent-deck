import './preview.css';

const preview = {
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        desktop1280: { name: 'Desktop 1280', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
        desktop1440: { name: 'Desktop 1440', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
        narrow1024: { name: 'Narrow 1024', styles: { width: '1024px', height: '700px' }, type: 'desktop' },
      },
    },
  },
  initialGlobals: { viewport: { value: 'desktop1440', isRotated: false } },
};
export default preview;
