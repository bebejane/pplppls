import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const main = async () => {
	const modelsPath = path.join(process.cwd(), 'public/models');
	const indexPath = path.join(modelsPath, 'index.json');
	const models = await Promise.all(
		fs
			.readdirSync(modelsPath)
			.filter((f) => f.endsWith('.zip'))
			.map((modelName: string) => {
				const data = fs.readFileSync(path.join(modelsPath, modelName));
				return JSZip.loadAsync(data).then(async (zip) => {
					const model = zip.file('index.json');
					return JSON.parse(await model.async('text'));
				});
			}),
	).catch((err) => {
		console.error(err);
		process.exit(1);
	});

	fs.writeFileSync(indexPath, JSON.stringify(models, null, 2));
};

main();
