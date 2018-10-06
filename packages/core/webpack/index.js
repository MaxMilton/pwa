const { join } = require('path');
const CopyAssets = require('@pwa/webpack-assets');
const OptimizeCSS = require('optimize-css-assets-webpack-plugin');
const UglifyJS = require('uglifyjs-webpack-plugin');
const HTML = require('html-webpack-plugin');
const toHTMLConfig = require('./html');

module.exports = function (src, config, opts) {
	const webpack = opts.webpack;
	opts.log = opts.log || console;

	let isProd = opts.production;
	let bundle = ['./index.js'];

	let { babel, browsers, postcss, uglify } = config;
	let extns = ['.wasm', '.mjs', '.js', '.json']; // webpack defaults

	// Apply "browserlist" to Babel config
	babel.presets = babel.presets.map(x => {
		if (!Array.isArray(x) || x[0] !== '@babel/preset-env') return x;
		let tars = x[1].targets;
		if (tars && tars.esmodules) {
			opts.log.warn('Babel ignores `browsers` when `esmodules` are targeted');
		} else {
			x[1].targets = Object.assign({ browsers }, x[1].targets);
		}
		return x;
	});

	// Construct Style rules
	let styles = require('./style')(postcss, opts);

	if (!isProd) {
		bundle.push(
			require.resolve('webpack-dev-server/client'),
			require.resolve('webpack/hot/dev-server')
		);
	}

	return {
		context: src,
		entry: { bundle },
		output: {
			publicPath: '/',
			path: join(opts.cwd, opts.dest || 'build'),
			filename: isProd ? '[name].[hash:8].js' : '[name].js',
			chunkFilename: isProd ? '[name].chunk.[chunkhash:5].js' : '[name].chunk.js'
		},
		mode: isProd ? 'production' : 'development',
		resolve: {
			alias: {
				// locals
				'@': src,
				'@tags': join(src, 'tags'),
				'@assets': join(src, 'assets'),
				'@components': join(src, 'components'),
				'@static': join(src, 'static'),
				'@pages': join(src, 'pages'),
			},
			extensions: extns.concat('.jsx', styles.extns)
		},
		node: {
			process: false,
			setImmediate: false,
			__filename: false,
			__dirname: false,
			console: false,
			Buffer: false,
		},
		performance: {
			maxAssetSize: 2e5, // 200kb
			maxEntrypointSize: 2e5,
			hints: isProd && 'warning',
			assetFilter: str => !(/\.map|mp4|ogg|mov|webm$/.test(str)),
		},
		module: {
			rules: [{
				include: src,
				test: /\.jsx?$/,
				loader: 'babel-loader',
				options: babel
			}, {
				test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif|mp4|mov|ogg|webm)(\?.*)?$/i,
				loader: isProd ? 'file-loader' : 'url-loader'
			}, {
				test: /\.(xml|html|txt|md)$/,
				loader: 'raw-loader'
			}].concat(styles.rules)
		},
		devtool: isProd ? 'source-map' : 'inline-source-map',
		plugins: [
			// new webpack.NoEmitOnErrorsPlugin(),
			new HTML(toHTMLConfig(src, opts))
		].concat(styles.plugins, isProd ? [
			new CopyAssets(src),
			new webpack.HashedModuleIdsPlugin(),
			new webpack.LoaderOptionsPlugin({ minimize:true })
		] : [
			new webpack.NamedModulesPlugin(),
			new webpack.HotModuleReplacementPlugin()
		]),
		optimization: {
			minimizer: [
				new UglifyJS(uglify),
				new OptimizeCSS({})
			]
		},
		devServer: {
			stats: false, // quiet
			overlay: true,
			compress: true,
			historyApiFallback: true,
			disableHostCheck: true,
			watchOptions: {
				ignored: [
					join(opts.cwd, 'build'),
					join(opts.cwd, 'node_modules')
				]
			}
		}
	};
}
