/**
 * @list dependencies
 */

var ID = require('short-id')
  , mongoose = require('mongoose')
  , Promise = require('node-promise').Promise
  , ShortURL = require('../models/ShortURL').ShortURL;

/**
 * @configure short-id
 */

ID.configure({
  length: 6,
  algorithm: 'sha1',
  salt: Math.random
});

/**
 * @method connect
 * @param {String} mongdb Mongo DB String to connect to
 */

exports.connect = function(mongodsn) {

  const options = {
    autoIndex: true, // Don't build indexes
    reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
    reconnectInterval: 500, // Reconnect every 500ms
    poolSize: 40, // Maintain up to 10 socket connections
    useNewUrlParser: true
    // If not connected, return errors immediately rather than waiting for reconnect
    //bufferMaxEntries: 0
  };

  setTimeout(function() {
      mongoose.connect(mongodsn, options)
      .then(function(){
        console.log('Successfully connected to database ' + mongodsn);
        exports.connection = mongoose.connection;
      })
      .catch(function(err) {
        // Check error in initial connection. There is no 2nd param to the callback.
        console.log('Error when connecting to db ' + mongodsn + '\n\r' + err);
        exports.connection = mongoose.connection;
      });
  }, 60);
};

/**
 * @method generate
 * @param {Object} options Must at least include a `URL` attribute
 */

exports.generate = function(document) {
  var generatePromise
    , promise = new Promise();

  document['data'] = document.data || null;

  // hash was specified, so we should always honor it
  if (document.hasOwnProperty('hash')) {
    generatePromise = ShortURL.create(document);
  } else {
    document['hash'] = ID.store(document.URL);
    generatePromise = ShortURL.findOrCreate({URL : document.URL}, document, {});
  }

  generatePromise.then(function(ShortURLObject) {
    promise.resolve(ShortURLObject);
  }, function(error) {
    promise.reject(error, true);
  });

  return promise;
};

/**
 * @method retrieve
 * @param {Object} options Must at least include a `hash` attribute
 */

exports.retrieve = function(hash) {
  var promise = new Promise();
  var query = { hash : hash }
    , update = { $inc: { hits: 1 } }
    , options = { multi: true };
  var retrievePromise = ShortURL.findOne(query);
  ShortURL.update( query, update , options , function (){ } );
  retrievePromise.then(function(ShortURLObject) {
    if (ShortURLObject && ShortURLObject !== null) {
      promise.resolve(ShortURLObject);
    } else {
      promise.reject(new Error('MongoDB - Cannot find Document'), true);
    };
  }, function(error) {
    promise.reject(error, true);
  });
  return promise;
};

/**
 * @method update
 * @param {String} hash - must include a `hash` attribute
 * @param {Object} updates - must include either a `URL` or `data` attribute
 */

exports.update = function(hash, updates) {
  var promise = new Promise();
  ShortURL.findOne({hash: hash}, function(err, doc) {
    if (updates.URL) {
      doc.URL = updates.URL;
    }
    if (updates.data) {
      doc.data = extend(doc.data, updates.data);
      doc.markModified('data'); //Required by mongoose, as data is of Mixed type
    }
    doc.save(function(err, updatedObj, numAffected) {
      if (err) {
        promise.reject(new Error('MongoDB - Cannot save updates'), true);
      } else {
        promise.resolve(updatedObj);
      }
    });
  });
  return promise;
};

/**
 * @method hits
 * @param {Object} options Must at least include a `hash` attribute
 */

exports.hits = function(hash) {
  var promise = new Promise();
  var query = { hash : hash }
    , options = { multi: true };
  var retrievePromise = ShortURL.findOne(query);
  retrievePromise.then(function(ShortURLObject) {
    if (ShortURLObject && ShortURLObject !== null) {
      promise.resolve(ShortURLObject.hits);
    } else {
      promise.reject(new Error('MongoDB - Cannot find Document'), true);
    };
  }, function(error) {
    promise.reject(error, true);
  });
  return promise;
};

/**
 * @method list
 * @description List all Shortened URLs
 */

exports.list = function() {
  return ShortURL.find({});
};

/**
 * @method extend
 * @description Private function to extend objects
 * @param {Object} original The original object to extend
 * @param {Object} updated The updates; new keys are added, existing updated
 */

var extend = function(original, updates) {
  Object.keys(updates).forEach(function(key) {
    original[key] = updates[key];
  });
  return original;
};
