const { getTracks, runPromiseSequentially, download } = require('./utils');

const downloader = async () => {
  try {
    const params = process.argv.slice(2);

    if (params.length < 2) {
      throw new Error('Require 2(two) parameters to execute.');
    }

    const [url, folderPath] = params;

    // eslint-disable-next-line no-console
    console.info(
      `Prepare to download playlist from ${JSON.stringify(
        url,
      )} to ${JSON.stringify(folderPath)}`,
    );

    const tracks = await getTracks(url);
    await runPromiseSequentially(tracks, download, folderPath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error.message);
  }
};

module.exports = downloader;
