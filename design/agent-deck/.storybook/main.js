import tailwindcss from '@tailwindcss/vite';

const config = {
  stories: ['../stories/**/*.stories.@(js|ts)'],
  framework: '@storybook/html-vite',
  viteFinal: async (cfg) => {
    cfg.plugins = [...(cfg.plugins || []), tailwindcss()];
    return cfg;
  },
};
export default config;
