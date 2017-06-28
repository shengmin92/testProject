// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 
var nconf = require('nconf');
nconf.env().file({ file: 'config.json', search: true });
var express = require('express');
var expressLayouts = require('express-ejs-layouts');
var path = require('path');
var azure = require('azure-storage');
var formidable = require('formidable');
var helpers = require('./helpers.js');

var app = express();
var account = nconf.get("STORAGE_NAME");
var cs = nconf.get("CONNECTION_STRING");
// Global request options, set the retryPolicy
var blobClient = azure.createBlobService(cs).withFilter(new azure.ExponentialRetryPolicyFilter());
var containerName = 'webpi';

//Configuration
app.set('views', path.join(__dirname + '/views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname + '/public')));
app.use(expressLayouts);

app.set('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.set('production', function(){
  app.use(express.errorHandler());
});

app.param('id', function (req, res, next) {
  next();
});



//Routes
// app.get('/', function (req, res) {
//
//   res.render('index.ejs', { title: 'List of containers });
// });
app.get('/', function (req, res) {
    blobClient.listContainersSegmented(null, function (error, results){
        if (error) {
            alert('List container error, please open browser console to view detailed error');
            console.log(error);
        } else {
            res.render('index.ejs', { title: 'List of containers', serverContainers: results.entries });
        }
    });

});



// app.get('/Upload', function (req, res) {
//
//     console.log(containerName);
//   res.render('upload.ejs', { title: 'Upload File', ContainerFlag: (containerName.length===null)});
// });

app.get('/Display', function (req, res) {
  blobClient.listBlobsSegmented(containerName, null, function (error, blobs, result) {
      if (blobs===null){
          // helpers.renderError(res);
          res.render('display.ejs', { title: 'List of Blobs' ,serverBlobs: null});
      }else{
          res.render('display.ejs', { title: 'List of Blobs', serverBlobs: blobs.entries });
      }

  });
});

app.get('/Download/:id', function (req, res) {
  blobClient.getBlobProperties(containerName, req.params.id, function (err, blobInfo) {
    if (err === null) {
      res.header('content-type', blobInfo.contentType);
      res.header('content-disposition', 'attachment; filename=' + blobInfo.metadata.filename);
      blobClient.getBlobToStream(containerName, req.params.id, res, function () { });
    } else {
      helpers.renderError(res);
    }
  });
});

app.post('/uploadhandler', function (req, res) {
  var form = new formidable.IncomingForm();
  form.multiples = true;


  form.parse(req, function (err, fields, files) {
      var errorflag =false;
      var filearray = [];
      var restmp = res;
      var finishedOrError;
      if (files.uploadedFile.length === undefined) {
          filearray = [files.uploadedFile];

      }
      else{
          filearray = files.uploadedFile;
      }
      //////////////////////////////////////
      var options;
      var blockSize;

      var speedSummary;
      for (var i=0;i<filearray.length;i++){
          // console.log(filearray[i].name);
          blockSize = filearray[i].size > 1024 * 1024 * 32 ? 1024 * 1024 * 4 : 1024 * 512;
          finishedOrError = false;
          options = {
              contentType: filearray[i].type,
              metadata: { fileName: filearray[i].name },
              blockSize : blockSize
          };

          blobClient.singleBlobPutThresholdInBytes = blockSize;

          speedSummary = blobClient.createBlockBlobFromLocalFile(containerName, filearray[i].name, filearray[i].path, options, function(error) {
              finishedOrError = true;
              if (error) {
                  console.log(error);
                  helpers.renderError(res);
                  errorflag = true;
              }
              else {
                  // console.log("====== " +i+" ======");
                  // console.log(res);
              }
          });


      }

      // function refreshProgress() {
      //     setTimeout(function() {
      //         if (!finishedOrError) {
      //             var process = speedSummary.getCompletePercent();
      //             console.log("current: "+process);
      //             refreshProgress();
      //         }
      //     }, 200);
      // }
      while (speedSummary.getCompletePercent()<100){
          console.log(speedSummary.getCompletePercent());
      }


      res.redirect('/Display');

  });
});

app.post('/Delete/:id', function (req, res) {
  blobClient.deleteBlob(containerName, req.params.id, function (error) {
    if (error != null) {
      helpers.renderError(res);
    } else {
      res.redirect('/Display');
    }
  });
});

blobClient.createContainerIfNotExists(containerName, function (error) {
  if (error) {
    console.log(error);
  } else { 
    setPermissions();
  }
});

function setPermissions() {
  var options = { publicAccessLevel: azure.BlobUtilities.BlobContainerPublicAccessType.BLOB };
  blobClient.setContainerAcl(containerName, null, options, function (error) {
    if (error) {
      console.log(error);
    } 
  });
}



module.exports = app;