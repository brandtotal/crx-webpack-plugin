var fs = require('fs');
var path = require('path');
var nodePath = path;
var join = path.join;
var mkdirp = require('mkdirp');
var ChromeExtension = require('crx');

function Plugin(options) {
  this.options = options || {};
  if (!this.options.updateUrl) {
    this.options.updateUrl = "http://localhost:8000/";
  }
  if (!this.options.updateFilename) {
    this.options.updateFilename = "updates.xml";
  }

  // remove trailing slash
  this.options.updateUrl = this.options.updateUrl.replace(/\/$/, "");

  // setup paths
  this.context = path.dirname(module.parent.filename);
  this.keyFile = path.isAbsolute(this.options.keyFile) ? this.options.keyFile : join(this.context, this.options.keyFile);
  this.outputPath = path.isAbsolute(this.options.outputPath) ? this.options.outputPath : join(this.context, this.options.outputPath);
  this.contentPath = path.isAbsolute(this.options.contentPath) ? this.options.contentPath : join(this.context, this.options.contentPath);
  this.exclude = this.options.exclude || [];

  // set output info
  this.crxName = this.options.name + ".crx";
  this.crxFile = join(this.outputPath, this.crxName);
  this.updateFile = join(this.outputPath, this.options.updateFilename);
  this.updateUrl = this.options.updateUrl + "/" + this.options.updateFilename;

  // initiate crx
  this.crx = new ChromeExtension({
    privateKey: fs.readFileSync(this.keyFile),
    codebase: this.options.updateUrl + '/' + this.crxName
  });
}

// hook into webpack
Plugin.prototype.apply = function (compiler) {
  var self = this;

  compiler.plugin('after-emit', (compilation, cb) => {
    this.package().then(() => {
      cb();
    });
  });
}

// package the extension
Plugin.prototype.package = function () {
  var self = this;

  let loadParam = this.contentPath;

  if (this.exclude.length > 0) {
    loadParam = recursiveReaddirSync(this.contentPath).filter((file) => {
      return !this.exclude.some((excludeReg) => {
        return excludeReg.test(file);
      });
    }).map((file) => {
      return file;
    });
  }

  return self.crx.load(loadParam).then(function () {
    return self.crx.pack();
  }).then(function (buffer) {
    return new Promise((res, rej) => {
      mkdirp(self.outputPath, function (err) {
        if (err) { rej(err); return; }

        var updateXML = self.crx.generateUpdateXML();
        fs.writeFile(self.updateFile, updateXML, function (err) {
          if (err) { rej(err); return; }

          fs.writeFile(self.crxFile, buffer, function (err) {
            if (err) { rej(err); return; }

            res();
          });
        });
      });
    });
  });
}

function recursiveReaddirSync(path) {
  var list = []
    , files = fs.readdirSync(path)
    , stats
    ;

  files.forEach(function (file) {
    stats = fs.lstatSync(nodePath.join(path, file));
    if (stats.isDirectory()) {
      list = list.concat(recursiveReaddirSync(nodePath.join(path, file)));
    } else {
      list.push(nodePath.join(path, file));
    }
  });

  return list;
}

module.exports = Plugin;
