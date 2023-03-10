//const path = require('path')
//const { override } = require('customize-cra')
//const { addReactRefresh } = require('customize-cra-react-refresh')

/**
 * React App Rewired Config
 */
module.exports = {
	// Update webpack config to use custom loader for worker files
	webpack: (config) => {
		config.module.rules.unshift({
			test: /worker\.js$/,
			use: {
				loader: "worker-loader",
				options: {
					// Use directory structure & typical names of chunks produces by "react-scripts"
					name: "static/js/[id].worker.[contenthash:8].js",
				},
			},
		});
		/*
    config.module.rules.push({
        loader: "webpack-modernizr-loader",
        options: {
          options: ["setClasses"],
          "feature-detects": [
            "test/css/flexbox",
            "test/es6/promises",
            "test/serviceworker"
          ]
          // Uncomment this when you use `JSON` format for configuration
          // type: 'javascript/auto'
        },
        test: /empty-alias-file\.js$/
    })
    config.resolve.alias['modernizr$'] = path.resolve(__dirname, "node_modeules/modernizr/.js")
    */
		return config;
	},
};
