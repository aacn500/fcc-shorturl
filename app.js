'use strict';

const express = require('express');
const MongoClient = require('mongodb').MongoClient;

const PORT = process.env.PORT || 3000;
const MONGOURL = process.env.MONGOURL || 'mongodb://localhost:27017/urls';
const HOSTNAME = process.env.HOST || 'http://localhost:3000/';

let app = express();

let db = new Promise(function (resolve, reject) {
  MongoClient.connect(MONGOURL, function(err, db) {
    if (err)
      reject(err);
    else
      resolve(db);
  });
});

db.catch(function(reason) {
  console.error('Failed to connect to db: ' + reason);
  process.exit(1);
});

function generateShortUrl() {
  // http://stackoverflow.com/a/1349426
  let t = '';
  let possChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i=0; i<4; i++)
    t += possChars.charAt(Math.floor(Math.random() * possChars.length));

  return t;
}

function handleErr(err, res) {
  console.error(err);
  res.status(500).send('Server encountered an error. Woops ¯\\_(ツ)_/¯');
}

// http://www.gnuterrypratchett.com/#nodejs
app.use(function clacksOverhead(req, res, next) {
  res.set('X-Clacks-Overhead', 'GNU Terry Pratchett');
  next();
});

app.get('/shorten', function shortenUrl(req, res) {
  let resObj = {};

  let url = req.query.url;
  resObj.originalUrl = url;

  if (!url) {
    res.send('If you want to shorten a url, you should probably provide one.\n'
           + 'Do it like this: /shorten?url=www.google.com\n'
           + 'Now you try! :)');
    return;
  }

  // find the 'urls' collection
  let collection = db.then(function(db) {
    // returns promise. yay chaining!
    return db.collection('urls');
  }, function(reason) {
    handleErr(reason, res);
  });

  // find if this url has been shortened before. if it has,
  // return the existing shortened form
  collection.then(function(collection) {
    // returns promise. yay chaining! x2
    return collection.findOne({originalUrl: url});
  }, function(reason) {
    handleErr(reason, res);
  }).then(function(doc) {
    // if doc is defined, url has already been shortened
    if (doc) {
      resObj.shortUrl = HOSTNAME + doc.shortUrl;
      return resObj;
    } else {
      // doc is undefined, so need to shorten url
      return collection.then(function(collection) {
        resObj.shortUrl = generateShortUrl();
        // returns promise. yay chaining! x3
        return collection.insertOne(resObj);
      }, function(reason) {
        handleErr(reason, res);
      }).then(function(insertResult) {
        let originalUrl = insertResult.ops[0].originalUrl;
        let shortUrl = insertResult.ops[0].shortUrl;
        return {originalUrl, shortUrl: HOSTNAME + shortUrl};
      }, function(reason) {
        handleErr(reason, res);
      });
    }
  }, function(reason) {
    handleErr(reason, res);
  }).then(function(result) {
    res.send(result);
  }, function(reason) {
    handleErr(reason, res);
  });
});

app.get(/^\/[0-9a-zA-Z]{4}$/, function expandUrl(req, res) {
  let shortUrl = req.path.slice(1); // remove leading /
  db.then(function(db) {
    return db.collection('urls');
  }, function(reason) {
    handleErr(reason, res);
  }).then(function(collection) {
    // promise chaining
    return collection.findOne({shortUrl});
  }, function(reason) {
    handleErr(reason, res);
  }).then(function(doc) {
    if (!doc) {
      res.send('Didn\'t find any short urls matching that. Are you sure it exists?');
    } else {
      let url = doc.originalUrl;
      if (url.match(/^https?:\/\//)) {
        res.redirect(doc.originalUrl);
      } else {
        res.redirect('http://' + doc.originalUrl);
      }
    }
  }, function(reason) {
    handleErr(reason, res);
  });
});

app.get('/', function index(req, res) {
  res.sendFile('html/index.html', {root: __dirname + '/public/'});
});

app.use(function errorHandler(err, req, res, next) {
  handleErr(err, res);
});

app.use(function err404(req, res) {
  res.status(404).send('404: this file was not found. Woops ¯\\_(ツ)_/¯');
});

app.listen(PORT, function() {
  console.log('process is listening on port ' + PORT);
});
