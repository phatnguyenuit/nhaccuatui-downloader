const fs = require('fs');
const path = require('path');

const fetch = require('node-fetch');
const { parseStringPromise } = require('xml2js');

// const SAMPLE_URL =
//   'https://www.nhaccuatui.com/playlist/bai-hat-yeu-thich-thang-052021-va.sw52jWGuJEeT.html';

/**
 * Read URL as HTML string
 * @param {string} url
 * @returns Promise<string>
 */
const requestHtmlText = (url) => {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => response.text())
      .then(resolve)
      .catch(reject);
  });
};

const FAILED_TO_EXTRACT_XML_URL_ERROR = new Error(
  'Failed to extract xml playlist location.',
);

const getTracks = async (nhaccuatuiYUrl) => {
  const htmlText = await requestHtmlText(nhaccuatuiYUrl);
  const regex = /player\.peConfig\.xmlURL\s=\s"(?<xmlUrl>.+)";/;
  const match = regex.exec(htmlText);
  if (!match) {
    throw FAILED_TO_EXTRACT_XML_URL_ERROR;
  }

  const xmlUrl = match.groups.xmlUrl;
  if (!xmlUrl) {
    throw FAILED_TO_EXTRACT_XML_URL_ERROR;
  }

  const xmlText = await requestHtmlText(xmlUrl);
  const parsedXmlObj = await parseStringPromise(xmlText);
  const tracks = parsedXmlObj.tracklist.track || [];

  return tracks.map((track) => {
    const title = track.title[0].trim();
    const url = track.location[0].trim();
    const fileNameReg = /(?<fileName>[\w-\d]+\.mp3)/;
    const match = fileNameReg.exec(url);
    const fileName = match.groups.fileName || `${title}.mp3`;
    return {
      fileName,
      title,
      url,
    };
  });
};

async function exists(path) {
  try {
    await fs.promises.access(path);
    return true;
  } catch (e) {
    return false;
  }
}

const download = async (track, folderPath) => {
  try {
    const absolutePath = path.resolve(folderPath);
    const isExisted = await exists(absolutePath);
    if (!isExisted) {
      await new Promise((resolve, reject) => {
        fs.mkdir(absolutePath, { recursive: true }, (err, path) => {
          if (!err) {
            resolve();
          } else {
            reject(new Error(`Failed to create directory ${path}`));
          }
        });
      });
    }

    const res = await fetch(track.url);
    const fileStream = fs.createWriteStream(
      path.resolve(absolutePath, track.fileName),
    );
    // eslint-disable-next-line no-console
    console.info(`Downloading file ${track.fileName}...`);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', () => {
        // eslint-disable-next-line no-console
        console.info(`Downloaded file ${track.fileName}!`);
        resolve();
      });
    });

    return true;
  } catch (error) {
    throw new Error('Fail to download.');
  }
};

const runPromiseSequentially = (iterator, promiseCreator, ...params) => {
  return iterator.reduce(
    (prevPromise, item) =>
      // eslint-disable-next-line no-useless-call
      prevPromise.then((_) => promiseCreator.apply(null, [item, ...params])),
    Promise.resolve(),
  );
};

const downloader = async () => {
  try {
    // eslint-disable-next-line no-unused-vars
    const [url, folderPath, ..._] = process.argv.slice(2);
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