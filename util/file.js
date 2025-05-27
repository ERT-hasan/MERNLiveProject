const fs = require('fs');
const path = require('path');

exports.deleteFile = (filePath) => {
  // relative path ko absolute path me convert karo
  const absolutePath = path.join(__dirname, '..', filePath);

  fs.unlink(absolutePath, (err) => {
    if (err) {
      // Throw karne ki jagah log karna safe hota hai
      console.error('Error deleting file:', err);
    } else {
      console.log('File deleted:', absolutePath);
    }
  });
};
