'use strict';
/*
 *  ▄▄▄       █    ██ ▄▄▄█████▓ ▒█████    ██████  ██▓███  ▓█████  ▄████▄  ▄▄▄█████▓▓█████  ██▀███        ▄▄▄██▀▀▀██████
 * ▒████▄     ██  ▓██▒▓  ██▒ ▓▒▒██▒  ██▒▒██    ▒ ▓██░  ██▒▓█   ▀ ▒██▀ ▀█  ▓  ██▒ ▓▒▓█   ▀ ▓██ ▒ ██▒        ▒██ ▒██    ▒
 * ▒██  ▀█▄  ▓██  ▒██░▒ ▓██░ ▒░▒██░  ██▒░ ▓██▄   ▓██░ ██▓▒▒███   ▒▓█    ▄ ▒ ▓██░ ▒░▒███   ▓██ ░▄█ ▒        ░██ ░ ▓██▄
 * ░██▄▄▄▄██ ▓▓█  ░██░░ ▓██▓ ░ ▒██   ██░  ▒   ██▒▒██▄█▓▒ ▒▒▓█  ▄ ▒▓▓▄ ▄██▒░ ▓██▓ ░ ▒▓█  ▄ ▒██▀▀█▄       ▓██▄██▓  ▒   ██▒
 *  ▓█   ▓██▒▒▒█████▓   ▒██▒ ░ ░ ████▓▒░▒██████▒▒▒██▒ ░  ░░▒████▒▒ ▓███▀ ░  ▒██▒ ░ ░▒████▒░██▓ ▒██▒ ██▓  ▓███▒ ▒██████▒▒
 *  ▒▒   ▓▒█░░▒▓▒ ▒ ▒   ▒ ░░   ░ ▒░▒░▒░ ▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░░░ ▒░ ░░ ░▒ ▒  ░  ▒ ░░   ░░ ▒░ ░░ ▒▓ ░▒▓░ ▒▓▒  ▒▓▒▒░ ▒ ▒▓▒ ▒ ░
 *   ▒   ▒▒ ░░░▒░ ░ ░     ░      ░ ▒ ▒░ ░ ░▒  ░ ░░▒ ░      ░ ░  ░  ░  ▒       ░     ░ ░  ░  ░▒ ░ ▒░ ░▒   ▒ ░▒░ ░ ░▒  ░ ░
 *   ░   ▒    ░░░ ░ ░   ░      ░ ░ ░ ▒  ░  ░  ░  ░░          ░   ░          ░         ░     ░░   ░  ░    ░ ░ ░ ░  ░  ░
 *       ░  ░   ░                  ░ ░        ░              ░  ░░ ░                  ░  ░   ░       ░   ░   ░       ░
 *                                                               ░                                   ░
*/

// -----------------------------------------------------------------------------
//                                LIB INITIALIZATION
// -----------------------------------------------------------------------------

// var title = require('./autospecter_title');
var loopback = require('loopback');
var _ = require('lodash');
var q = require('q');
var fs = require('fs');
var path = require('path');
var jsonfile = require('jsonfile');
var writeEndpoint = require('./write-enpoints');
var mysql = require('mysql');
var big = require('./big-log');


// -----------------------------------------------------------------------------
//                          SET CONFIG VARS
// -----------------------------------------------------------------------------

// Models in this array will be ignored in this script
const IGNORE = ['AccessToken', 'ACL', 'RoleMapping', 'Role', 'User'];

// Set path to get existing models from loopback (if they exist)
var loopbackModelPath = path.join(__dirname, '../../common/models');

// Set path to get the current model-config
var modelConfigPath = path.join(__dirname, '../../server/model-config.json');

var _database = {
  name: 'DBname',
  user: 'DBuser',
  password: 'DBpass',
  host: 'DBhostIP',
  port: 'DBport'
}

// Settings for the loopback datasource
var loopbackConfig = {
  host: _database.host,
  port: _database.port,
  database: _database.name,
  user: _database.user,
  password: _database.password,
  name: 'loopbackDatasource',
  connector: 'mysql'
};

// settings for the mysql datasource
var mysqlConfig = {
  host: _database.host,
  port: _database.port,
  database: _database.name,
  user: _database.user,
  password: _database.password,
  connectionLimit: 20,
  multipleStatements: true
};


// -----------------------------------------------------------------------------
//                                SETUP
// -----------------------------------------------------------------------------

// This prints the autospecter title inside the host terminal
// title.run();

// Stores the model config to be edited later
var modelConfig;

// Stores a map of the 2 sets of models (mysql and loopback)
var modelMap = {};

// Setup datasources
var loopbackDatasource = loopback.createDataSource('loopbackDatasource', loopbackConfig);
var mysqlDatasource = mysql.createPool(mysqlConfig);


var _setModelConfig = function () {
  var deffered = q.defer();

  fs.readFile(
    modelConfigPath,
    function (err, data) {
      if (err) { deffered.reject(err); }

      deffered.resolve(JSON.parse(data.toString()));
    }
  );

  return deffered.promise;
};

// -----------------------------------------------------------------------------
//                                DATABASE
// -----------------------------------------------------------------------------

// Filters out non-related tables
var _filterTables = function (tables) {
  return _.filter(tables, { owner: _database.name });
};

// Gets tables from database
var _getTables = function () {
  var deffered = q.defer();
  loopbackDatasource.discoverModelDefinitions({ all: true },
    function (err, tables) {
      if (err) { return deffered.reject(err); }
      return deffered.resolve(_filterTables(tables));
    });
  return deffered.promise;
};

// Gets model schema from mysql for a table
var _getMysqlSchema = function (tableName) {
  var deffered = q.defer();
  loopbackDatasource.discoverSchema(tableName, function (err, schema) {
    if (err) { return deffered.reject(err); }
    return deffered.resolve(schema);
  });
  return deffered.promise;
};

// Gets model schema from loopback if it exists
var _getLoopbackSchema = function (tableName) {
  var deffered = q.defer();

  fs.readFile(
    path.join(path.join(loopbackModelPath, _.toLower(tableName) + '.json')),
    function (err, data) {
      if (err) { deffered.reject(err); }
      if (data.toString()) {
        deffered.resolve(JSON.parse(data.toString()));
      } else {
        deffered.resolve(null);
      }

    }
  );

  return deffered.promise;
};

var _cleanProperties = function (properties, tableName) {
  var propertiesClean = q.defer();
  var promises = [];

  var setRequired = function (property, propertyName, deffered) {
    mysqlDatasource.query(
      'SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = \'' +
      tableName + '\' AND COLUMN_NAME = \'' + property.mysql.columnName + '\';',
      function (err, rows, fields) {
        if (rows.length > 0 && rows[0].COLUMN_DEFAULT) {
          property.required = false;
        }

        var ret = {};
        ret[propertyName] = property;

        deffered.resolve(ret);
      });
  };

  _.forEach(properties, function (property, propertyName) {
    var deffered = q.defer();
    promises.push(deffered.promise);
    setRequired(property, propertyName, deffered);
  });

  q.all(promises).then(
    function (properties) {
      var ret = {};

      _.forEach(properties, function (prop) {
        var key = _.first(_.keys(prop));
        ret[key] = prop[key];
      });

      propertiesClean.resolve(ret);
    }
  );

  return propertiesClean.promise;
};

var _cleanSchema = function (newSchema, currentSchema) {
  var deffered = q.defer();

  var schema = {
    name: newSchema.name,
    base: 'PersistedModel',
    idInjection: false,
    options: {
      validateUpsert: true,
    },
    mysql: newSchema.options.mysql,
    properties: newSchema.properties,
    validations: [],
    relations: {},
    acls: [],
    methods: {},
  };

  if (currentSchema) {
    schema.base = currentSchema.base;
  }

  _cleanProperties(newSchema.properties, schema.mysql.table)
  .then(function (properties) {
    schema.properties = properties;
    deffered.resolve(schema);
  });

  return deffered.promise;
};

// writes a new loopback model, adds model to model-config
var _writeNewModel = function (table, deffered) {
  _getMysqlSchema(table.name)
  .then(function (schema) {
    _cleanSchema(schema).then(function (model) {
      jsonfile.writeFile(
        path.join(loopbackModelPath, _.toLower(table.name) + '.json'),
        model,
        { spaces: 2 },
        function (err, data) {
          if (err) {
            console.log(err);
            return;
          }

          fs.writeFile(
            path.join(loopbackModelPath, _.toLower(table.name) + '.js'),
            Buffer.from(writeEndpoint.run(table.name)),
            function (err, data) {
              if (err) {
                console.log(err);
                return;
              }

              console.log('✓   ' + table.name + ' saved!');
              return _updateModelConfig(table.name, deffered);
            }
          );

        }
      );
    });

  });
};

// Adds a model to the model-config
var _updateModelConfig = function (tableName, deffered) {
  modelConfig[_.capitalize(tableName)] = {
    dataSource: loopbackConfig.name,
    public: true,
  };

  modelConfig = _(modelConfig).toPairs().sortBy(0).fromPairs().value();
  deffered.resolve(tableName);
  return;
};

// Writes model-config file to memory
var _writeModelConfig = function () {
  big.log('SAVING MODEL CONFIG', '*');
  jsonfile.writeFile(
    modelConfigPath,
    modelConfig,
    { spaces: 2 },
    function (err, data) {
      big.log('SCHEMA UPDATE COMPLETE', '✪');
      loopbackDatasource.disconnect();
      mysqlDatasource.end();
    }
  );
};

var _removeFromLoopback = function (tableName) {
  delete modelConfig[tableName];
  fs.unlinkSync(path.join(loopbackModelPath, _.toLower(tableName) + '.js'));
  fs.unlinkSync(path.join(loopbackModelPath, _.toLower(tableName) + '.json'));
  console.log('✓   Removed ' + tableName + ' from loopback!');
  return;
};

var _compareMslb = function (config, tables) {
  var addPromises = [];
  console.log('Comparing DB Schemas...');

  // Get all models from datasource
  var ms = _.map(tables, function (table) {
    modelMap[_.capitalize(table.name)] = table;
    return _.capitalize(table.name);
  });

  console.log('✓ MySql Tables Loaded');

  // Get all models from loopback modelconfig
  var lb = _.filter(_.keys(modelConfig), function (key) {
    return key[0] !== '_' && !IGNORE.includes(key);
  });

  console.log('✓ Loopback Models Loaded');

  // Calculate difference between the arrays
  var missingFromMysql = _.difference(lb, ms);
  var missingFromLoopback = _.difference(ms, lb);

  big.log('PURGING MODELS', '*');

  _.forEach(missingFromMysql, function (table) {
    console.log('⟳   Removing ' + table + '...');
    _removeFromLoopback(table);
  });

  big.log('ADDING MODELS', '*');

  _.forEach(missingFromLoopback, function (table) {
    var deffered = q.defer();
    addPromises.push(deffered.promise);

    console.log('⟳   Adding ' + table + '...');
    _writeNewModel(modelMap[table], deffered);
  });

  q.all(addPromises).then(
    function (data) {
      _updateModels(data)
      .then(_writeModelConfig);
    }
  );

};

var _updateModel = function (model, deffered) {
  var table = modelMap[model];
  _getMysqlSchema(table.name)
  .then(function (newSchema) {
    var schemaPath = path.join(loopbackModelPath, _.toLower(table.name) + '.json');
    var getCurrSchema = q.defer();

    jsonfile.readFile(schemaPath, function (err, currentSchema) {
      if (err) {
        return getCurrSchema.reject(err);
      }

      getCurrSchema.resolve(currentSchema);
    });

    getCurrSchema.promise.then(function (currentSchema) {
      _cleanSchema(newSchema, currentSchema)
      .then(function (model) {
        jsonfile.writeFile(
          schemaPath,
          model,
          { spaces: 2 },
          function (err, data) {
            if (err) {
              console.log(err);
              return;
            }

            console.log('✓   ' + table.name + ' updated!');
            return deffered.resolve();
          }
        );
      });
    });
  });
};

var _updateModels = function (newModels) {
  var update = q.defer();

  big.log('UPDATING EXISTING MODELS', '*');

  var updatePromises = [];

  var lb = _.filter(_.keys(modelConfig), function (key) {
    return (key[0] !== '_' && !IGNORE.includes(key)) && !newModels.includes(key);
  });

  _.forEach(lb, function (model) {
    var deffered = q.defer();
    updatePromises.push(deffered.promise);
    _updateModel(model, deffered);
  });

  q.all(updatePromises).then(function () {
    update.resolve();
  });

  return update.promise;
};

/*
--------------------------------------------------------------------------------
                            Main Func
--------------------------------------------------------------------------------
*/

// Set the model config before running comparisions
_setModelConfig().then(function (config) {
  modelConfig = config;

  // Get all tables from mysql
  _getTables().then(function (tables) {

    // Compare loopback and mysql models
    _compareMslb(modelConfig, tables);

  });
});
