# testProject

A test project for file management web application works with Azure blob storage and MongoDB

## Getting Started

First, download or clone the this project, you will get the folder name *testProject*. 

Then, create a file named *config.json* with the following JSON:

```
{
    "STORAGE_NAME": "<YOUR AZURE STORAGE NAME>",
    "STORAGE_KEY": "<YOUR AZURE STORAGE KEY>",
    "CONNECTION_STRING": "<YOUR AZURE CONNECTION STRING>",
    "MONGODB_CONNECTION_STRING": "<YOUR MONGODB CONNECTION STRING>"
}
```

Replace <YOUR AZURE STORAGE NAME>, <YOUR AZURE STORAGE KEY>, <YOUR AZURE CONNECTION STRING>, and <YOUR MONGODB CONNECTION STRING> 
with the correspoding information from your Azure and MongoBD account so that you can get access to them. 

Save this json file one directory level higher than the *testProject* directory, like this:

```
parent/
  |-- config.json
  |-- testProject/
```

If the information for configuration are correct, the project should run.
