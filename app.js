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
nconf.env().file({file: 'config.json', search: true});
var express = require('express');
var expressLayouts = require('express-ejs-layouts');
var path = require('path');
var azure = require('azure-storage');
var formidable = require('formidable');
var helpers = require('./helpers.js');

var app = express();
var account = nconf.get("STORAGE_NAME");
var cs = nconf.get("CONNECTION_STRING");
var blobUri = "";


// Global request options, set the retryPolicy
var blobClient = azure.createBlobService(cs).withFilter(new azure.ExponentialRetryPolicyFilter());  // 之后删掉
var containerName = ''; // = 'webpi'

//Configuration
app.set('views', path.join(__dirname + '/views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname + '/public')));
app.use(expressLayouts);

app.set('development', function () {
    app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

app.set('production', function () {
    app.use(express.errorHandler());
});

app.param('id', function (req, res, next) {
    next();
});

///////////////////////////////////////////////////////
// function checkIdentity(){
//     account = nconf.get("STORAGE_NAME");
//     cs = nconf.get("CONNECTION_STRING");
//
//     if (account == null || account.length < 1) {
//         console.log('Please enter a valid storage account name!');
//         return false;
//     }
//     if (cs == null || sas.length < 1) {
//         console.log('Please enter a valid SAS Token!');
//         return false;
//     }
//
//     return true;
// }
//
// function getBlobClient(){
//     if (!checkIdentity()){
//         return null;
//     }
//
//     blobUri = 'https://' + account + '.blob.core.windows.net';
//     var blobClient = azure.createBlobService(cs).withFilter(new azure.ExponentialRetryPolicyFilter());
//     return blobClient;
// }
///////////////////////////////////////////////////////////////////////


//Routes

app.get('/', function (req, res) {
    //
    blobClient.listContainersSegmented(null, function (error, containers, results) {
        if (error) {
            // res.render('index.ejs', {title: 'List of containers', serverContainers: containers.entries});
            console.log(error);
            // res.render('index.ejs', {title: 'List of containers', serverContainers: containers.entries, currentContainer: containerName});
        } else {

            res.render('index.ejs', {
                title: 'Aerial Insights - Folders Management',
                serverContainers: containers.entries,
                currentContainer: containerName
            });
        }
    });


});

/// <<<<<<<<<<<=================  
app.get('/Display', function (req, res) {
    if (containerName.length > 0) {
        blobClient.listBlobsSegmented(containerName, null, function (error, blobs, result) {
            if (blobs === null) {
                helpers.renderError(res);
                res.render('display.ejs', {
                    title: 'Aerial Insights - Files Management',
                    serverBlobs: null,
                    currentContainer: containerName,
                    azureAccount: account
                });
            } else {
                console.log(blobs.entries);
                res.render('display.ejs', {
                    title: 'Aerial Insights - Files Management',
                    serverBlobs: blobs.entries,
                    currentContainer: containerName,
                    azureAccount: account
                });
            }
        });
    } else {
        res.render('display.ejs', {
            title: 'Aerial Insights - Files Management',
            serverBlobs: null,
            currentContainer: containerName,
            azureAccount: account
        });
    }
});

app.get('/Download/:id', function (req, res) {
    blobClient.getBlobProperties(containerName, req.params.id, function (err, blobInfo) {
        if (err === null) {
            res.header('content-type', blobInfo.contentType);
            res.header('content-disposition', 'attachment; filename=' + blobInfo.metadata.filename);
            blobClient.getBlobToStream(containerName, req.params.id, res, function () {
            });
        } else {
            helpers.renderError(res);
        }
    });


});


app.post('/CreateContainer', function (req, res) {
    if (!blobClient) {
        // res.redirect('/');
        return;
    }
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        var newContainerName = fields.containerNameBox;
        blobClient.createContainerIfNotExists(newContainerName, function (error) {
            if (error) {
                console.log(error);

            } else {
                setPermissions(newContainerName);
                res.redirect('/');
            }
        });
    });


});


app.post('/uploadhandler', function (req, res) {
    var form = new formidable.IncomingForm();
    form.multiples = true;


    form.parse(req, function (err, fields, files) {
        var errorflag = false;
        var filearray = [];
        var finished = false;
        if (files.uploadedFile.length === undefined) {
            filearray = [files.uploadedFile];

        }
        else {
            filearray = files.uploadedFile;
        }
        //////////////////////////////////////
        var options;
        var blockSize;

        var speedSummary;
        for (var i = 0; i < filearray.length; i++) {

            blockSize = filearray[i].size > 1024 * 1024 * 32 ? 1024 * 1024 * 4 : 1024 * 512;
            finished = false;
            options = {
                contentType: filearray[i].type,
                metadata: {fileName: filearray[i].name},
                blockSize: blockSize
            };

            blobClient.singleBlobPutThresholdInBytes = blockSize;

            speedSummary = blobClient.createBlockBlobFromLocalFile(containerName, filearray[i].name, filearray[i].path, options, function (error) {

                if (error) {
                    console.log(error);
                    helpers.renderError(res);
                    errorflag = true;
                }
                else {

                    if (i == filearray.length - 1) res.redirect('/Display');
                }
            });
        }
    });
});


app.post('/DeleteContainer/:id', function (req, res) {
    console.log("Container deleted: " + req.params.id);

    blobClient.deleteContainerIfExists(req.params.id, function (error, result) {
        if (error) {
            // alert('Delete container failed, open brower console for more detailed info.');
            console.log(error);
        } else {
            // alert('Delete ' + name + ' successfully!');
            //refreshContainer();
            if (containerName === req.params.id) {
                containerName = "";
            }
            return res.redirect('/');
        }
    });
});


app.post('/Delete/:id', function (req, res) {
    console.log("Blob deleted: " + req.params.id);
    blobClient.deleteBlob(containerName, req.params.id, function (error) {
        if (error != null) {
            helpers.renderError(res);
        } else {
            res.redirect('/Display');
        }
    });
});

app.get('/SelectContainer/:name', function (req, res) {
    console.log("Container selected: " + req.params.name);
    containerName = req.params.name;
    blobClient.listContainersSegmented(null, function (error, containers, results) {
        if (error) {
            // res.render('index.ejs', {title: 'List of containers', serverContainers: containers.entries});
            console.log(error);
        } else {

            res.render('index.ejs', {
                title: 'List of containers',
                serverContainers: containers.entries,
                currentContainer: containerName
            });
        }
    });
});

// app.get('/container_Contents',function(req, res){
//     res.send
// })


// blobClient.createContainerIfNotExists(containerName, function (error) {
//     if (error) {
//         console.log(error);
//     } else {
//         setPermissions();
//     }
// });


function setPermissions(ctnName) {
    var options = {publicAccessLevel: azure.BlobUtilities.BlobContainerPublicAccessType.BLOB};
    blobClient.setContainerAcl(ctnName, null, options, function (error) {
        if (error) {
            console.log(error);
        }
    });
}



function refreshContainerList() {

}

module.exports = app;