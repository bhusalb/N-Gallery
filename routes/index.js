/*
 * GET home page.
 */

var fs = require('fs');
var fsPlus = require('../lib/fs-plus');
var path = require('path');
var imgSize = require('image-size');
var conf = require('../lib/config');
var log = require('../lib/logger');
var reImgType = /(\.jpg|\.jpeg|\.gif|\.png)$/i;

exports.index = function index(req, res) {

  var items = [];
  var baseDirs = conf.album_base_dirs; 
    
  baseDirs.forEach(function(baseDir) {
    Array.prototype.push.apply(items, folderHandler(baseDir));
  });
  conf.lang && res.setLocale(conf.lang);

  if (!items.length) {
    var dirs = conf.album_base_dirs;
    var msg = 'Nothing Found!';
    for (var i = 0; i < dirs.length; i++) {
      if (fs.existsSync(dirs[i])) {
        return;
      }
    }
    if (i === dirs.length) {
      msg = 'There are no valid gallery directories specified, check out che configuration file';
    }
    res.render('404', {content: msg, config: conf});
    return;
  }
  
  res.render('index', {title: res.__('首页'), items: items, base_dirs: baseDirs, config: conf, _blank: true});

};


exports.folder = function (req, res) {

  var folder  = fsPlus.toLinuxPath(req.params[0]);
  var items = folderHandler(folder);
  var title = path.basename(folder);

  // breadcrumb
  
  var absPath = folder;
  var dirs = conf.album_base_dirs;
  var breadcrumb = undefined;
  for (var i = 0; i < dirs.length; i++) {
    var basePath = fsPlus.toLinuxPath(dirs[i]);
    if (absPath.indexOf(basePath) === 0) {
      break;
    }
  }
  if (i != dirs.length) {
    var baseUrl = '/folder/';
    var nodePath = basePath.replace(/\/$/, '');
    var relPath = fsPlus.toLinuxPath(path.relative(nodePath, absPath));
    var pathNodes = [];
    relPath.split('/').forEach(function(node) {
      nodePath += '/' + node;
      pathNodes.push({
        name: node,
        url: baseUrl + nodePath
      });
    });
    
    breadcrumb = {
      base_path: basePath,
      base_url: baseUrl + basePath,
      path_nodes: pathNodes
    };
  }

  conf.lang && res.setLocale(conf.lang);

  if (!items.length) {
    res.render('404', {content: 'Nothing Found!', config: conf});
    return;
  }

  res.render('index', {title: title, items: items, config: conf, breadcrumb: breadcrumb, _blank: false})

};


exports.album = function (req, res) {

  var album = req.params[0];
  var pn = req.query['pn'] ? req.query['pn'] : 1;

  // at most "count_per_page" images per page
  var countPerPage = +conf['count_per_page'];
  var result = albumHandler(album, pn, countPerPage);
  var baseUrl = req.url.indexOf('?') != -1 ? req.url.split('?')[0] : req.url;
  var title = path.basename(album);

  conf.lang && res.setLocale(conf.lang);
  if (!result[0]) {
    res.render('404', {content: 'No Images Found!', config: conf});
    return;
  }
  
  res.render('album', {
    title: title,
    items: result[0],
    
    is_writable: fsPlus.isWritableSync(album),

    // url exclude query string
    url: baseUrl,

    // total page number, current page number
    page: {total: Math.ceil(result[1] / countPerPage), number: pn}, 
    config: conf
  });

};

exports.local = function (req, res) {

  // file path
  res.sendfile(req.params[0]);
};


exports.operationHandler = require('./operationHandler').operationHandler;


function folderHandler(baseDir) {

  if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
    return [];
  }

  var items = [];
  var files = fs.readdirSync(baseDir);
  var baseSize = 250;
  var defaultType = 'folder';

    // Add root directory
    files.push('');

    // => /a
    for (var i = 0; i < files.length; i++) {
      var curDir = files[i];
      var title = curDir ? curDir : path.basename(baseDir);
      var cover = null;
      var imgCount = 0;
      var dirCount = 0;
      var absCurDir = path.join(baseDir, curDir);

      if (curDir[0] == '.') {
        continue;
      }
      
      
      if (fs.statSync(absCurDir).isDirectory()) {
        var subFiles = fs.readdirSync(absCurDir);
        if (!subFiles.length) {
          continue;
        }
        
        var isWritable = fsPlus.isWritableSync(absCurDir);

        // => /a/b
        for (var j = 0; j < subFiles.length; j++) {
          var file = path.join(absCurDir, subFiles[j]);
          if (reImgType.test(subFiles[j])) {
            if (!cover) {
              cover = file;
            }
            imgCount++;
          } else if (fs.statSync(file).isDirectory()) {
            dirCount++;
          }
        }

        if (!imgCount) {

          // 根目录下面没有图片
          if (i == files.length - 1) {
            continue;
          }
          items.push({
            title: title,
            cover: 'images/folder.jpg',
            count: dirCount,
            size: {width: baseSize, height: baseSize - 30},
            href: '/' + defaultType + '/' + absCurDir,
            type: defaultType,
            is_writable: isWritable
          });
          continue;
        }

        var coverSize = {height: baseSize, width: baseSize};
        try {
          coverSize = imgSize(cover);
          coverSize.height = coverSize.height / coverSize.width * baseSize;  // width is fixed to 200
          coverSize.width = baseSize;
        } catch (e) {
          // pass
        }

        // 直接在baseDir根目录下的图片合集为'root'，如果文件夹不含子文件夹，则为type为'album'
        var type = (i == files.length - 1) ? 'root' : ((!dirCount) ? 'album' : defaultType);
        items.push({
          title: title,
          cover: 'local/' + cover,
          count: (type == 'album' || type == 'root') ? imgCount : dirCount,
          size: coverSize,
          href: '/' + type + '/' + absCurDir,
          type: type,
          is_writable: isWritable
        });
      }
    }

  return items;

}


function albumHandler(album, pn, countPerPage) {

  if (!fs.existsSync(album) || !fs.statSync(album).isDirectory()) {
    return [];
  }

  var files = fs.readdirSync(album);
  var items = [];
  var start = 0;
  var end = files.length;

  if (end > countPerPage) {
    start = (pn - 1) * countPerPage;
    end = start + countPerPage;
  }

  for (var i = start; i < end; i++) {
    if (reImgType.test(files[i])) {
      var item = {};
      var src = path.join(album, files[i]);
      item['src'] = fsPlus.toLinuxPath('local/' + src);
      var stat = fs.statSync(src);
      try {
        var size = imgSize(src);
        item['height'] = size['height'];
        item['width'] = size['width'];
      } catch (err) {
        item['height'] = 'Unknown';
        item['width'] = 'Unknown';
      }

      item['size'] = (stat.size >> 10) + ' KB';
      item['atime'] = stat.atime;
      item['mtime'] = stat.mtime;
      item['ctime'] = stat.ctime;
      items.push(item);
    }
  }

  return [items, files.length];

}
