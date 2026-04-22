const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const isWatchMode = process.argv.includes('--watch');

// Ensure the standard public directory exists
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Define the output file and the source directory
const outputPath = path.join(publicDir, 'focus-tracker-extension.zip');
const sourceDir = path.join(__dirname, '../../extension');

function zipExtension() {
  return new Promise((resolve, reject) => {
    console.log('Zipping extension from:', sourceDir);
    console.log('To:', outputPath);

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // listen for all archive data to be written
    output.on('close', function() {
      console.log('Extension zipped successfully: ' + archive.pointer() + ' total bytes');
      resolve();
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.warn(err);
      } else {
        reject(err);
      }
    });

    // good practice to catch this error explicitly
    archive.on('error', function(err) {
      reject(err);
    });

    output.on('error', function(err) {
      reject(err);
    });

    // pipe archive data to the file
    archive.pipe(output);

    // append files from a sub-directory, putting its contents at the root of archive
    archive.directory(sourceDir, false);

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();
  });
}

if (!isWatchMode) {
  zipExtension().catch((err) => {
    console.error('Failed to zip extension:', err);
    process.exit(1);
  });
} else {
  let isZipping = false;
  let zipQueued = false;
  let debounceTimer = null;

  const runZip = async (reason) => {
    if (isZipping) {
      zipQueued = true;
      return;
    }

    isZipping = true;
    console.log('Rebuilding extension zip (' + reason + ')...');

    try {
      await zipExtension();
    } catch (err) {
      console.error('Zip rebuild failed:', err);
    } finally {
      isZipping = false;
      if (zipQueued) {
        zipQueued = false;
        scheduleZip('queued changes');
      }
    }
  };

  const scheduleZip = (reason) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      runZip(reason);
    }, 200);
  };

  // Run once at startup so the zip is always fresh.
  runZip('initial startup');

  const watcher = fs.watch(sourceDir, { recursive: true }, (eventType, filename) => {
    const changedPath = filename ? String(filename) : '<unknown file>';
    scheduleZip(eventType + ': ' + changedPath);
  });

  watcher.on('error', (err) => {
    console.error('File watcher error:', err);
  });

  const shutdown = () => {
    console.log('Stopping zip watcher...');
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('Watching for changes in:', sourceDir);
  console.log('Press Ctrl+C to stop.');
}
