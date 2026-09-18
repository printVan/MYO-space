import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import path from 'node:path'
import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/next/config
export default defineConfig<'webpack5'>(async (merge) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'myblog-frontend',
    date: '2026-9-8',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    // 注入构建期环境变量：生产构建时 TARO_APP_API_BASE 指向线上后端，本地默认 localhost:3000
    defineConstants: {
      'process.env.TARO_APP_API_BASE': JSON.stringify(
        process.env.TARO_APP_API_BASE || 'http://localhost:3000/api'
      )
    },
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'vue3',
    compiler: {
      type: 'webpack5',
      prebundle: { enable: false }
    },
    // 顶层 postcss：Taro 4.2 的 H5 端从 combination.config.postcss 读取
    postcss: {
      // H5 桌面端使用真实 px（GitHub 官网风格），禁用小程序式 px→rem 缩放适配
      pxtransform: {
        enable: false
      }
    },
    terser: {
      enable: true,
      config: {
        // marked 11+ 使用 ES 私有字段（#parseMarkdown 等）。terser 的 mangle 与 compress
        // 都会改写私有字段结构，产生 "Private field must be declared in an enclosing class"
        // 语法错误。故完全关闭压缩（compress:false + mangle:false），仅做去除注释，
        // 私有字段原样保留，由现代浏览器原生支持。体积略增，功能不受影响。
        compress: false,
        mangle: false
      }
    },
    cache: {
      enable: false
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        url: {
          enable: true,
          config: {
            limit: 1024
          }
        },
        cssModules: {
          enable: false
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        // H5 桌面端使用真实 px（GitHub 官网风格），禁用小程序式 rem 缩放适配
        pxtransform: {
          enable: false
        },
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false
        }
      },
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash:8].css',
        chunkFilename: 'css/[name].[chunkhash:8].css'
      },
      webpackChain(chain) {
        // @ 路径别名（对应 tsconfig paths）
        chain.resolve.alias.set('@', path.resolve(__dirname, '..', 'src'))
        // CodeMirror 6 / marked 等库使用 ESM，确保被正确解析
        chain.resolve.alias.set('vue$', 'vue/dist/vue.esm-bundler.js')
        // marked 11+ 使用 ES 私有字段（#parseMarkdown 等）。babel-preset-taro 无条件启用
        // @babel/plugin-transform-class-properties，会把私有字段声明转译掉而保留访问，
        // 产生 "Private field must be declared in an enclosing class" 语法错误。
        // marked 产物是标准现代 ES（浏览器原生支持 class 与私有字段），跳过 babel 转译。
        chain.module.rule('script').exclude.add(/node_modules[\\/]marked[\\/]/)
        chain.optimization.splitChunks({
          chunks: 'all',
          cacheGroups: {
            codemirror: {
              name: 'codemirror',
              test: /[\\/]node_modules[\\/](@codemirror|codemirror)[\\/]/,
              priority: 30
            },
            naiveui: {
              name: 'naiveui',
              test: /[\\/]node_modules[\\/](naive-ui|@css-render|vooks|treemate|seemly)[\\/]/,
              priority: 25
            },
            vendors: {
              name: 'vendors',
              test: /[\\/]node_modules[\\/]/,
              priority: 10
            }
          }
        })
      }
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
