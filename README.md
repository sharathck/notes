# Generative AI Studio

## Lessons Learned 
### git push --mirror <new_repo> 
use above command to duplicate repo

```javascript
  console.log("URL:", "https://genaiapp-892085575649.us-central1.run.app/bigquery-search");
  fetch("https://genaiapp-892085575649.us-central1.run.app/bigquery-search", {
    method: "POST",
    body: JSON.stringify({
      uid: uid,
      limit: dataLimit,
      q: searchQuery,
      model: searchModel
    })
  })
  .then((res) => res.json())
  .then((text) => {
    setGenaiData(JSON.parse(text));
    setIsLoading(false);
    })
```
----------------- Single JSON Object ------------
```JSON
{
  "uid": "userid2",
  "limit": 10,
  "q": "How many models are available in ChatGPT?"
}
```
``` JaveScript Object
{
  uid: "userid2",
  limit: 10,
  q: "How many models are available in ChatGPT?"
}
```
------------------- JSON Array --------------
```JSON
[
  {
    "uid": "userid2",
    "limit": 10,
    "q": "How many models are available in ChatGPT?"
  },
  {
    "uid": "userid2",
    "limit": 10,
    "q": "How many models are available in ChatGPT?"
  }
]
```
``` JaveScript Array
[
  {
    uid: "userid2",
    limit: 10,
    q: "How many models are available in ChatGPT?"
  },
  {
    uid: "userid2",
    limit: 10,
    q: "How many models are available in ChatGPT?"
  }
]
```
-------------- While sending JSON object to server ------------
* JSON.Stringify will convert JSON object to string
  * in above example, JSON.stringify is used to convert JSON object to string before sending it to server

----------------- While receiving JSON object from server ------------
* JSON.Parse will convert string to JSON object
  * in above example, JSON.parse is used to convert string to JSON object after receiving it from server
  
## Custom Domain Setup - www.genai-all.com
* Go to settings -> Pages -> Custom domain -> Add custom domain
  * Add www.genai-all.com
  * Enforce HTTPS should be selected
  * It takes 15-20 minutes for the changes to reflect.
* Go to domain provider godaddy.com and add **CNAME** record with value (subdomain like **www.genai-all.com**)
  * CNAME: www -> sharathck.github.io
* Go to domain provider godaddy.com and add **A** record with values (Apex domain like **genai-all.com without www**) 
  * A: @ -> 185.199.108.153
  * A: @ -> 185.199.109.153
  * A: @ -> 185.199.110.153
  * A: @ -> 185.199.111.153
* **https://www.<sitename>.com** will initially display **insecure** site. It takse **10-15 minutes** to deploy security certificates, so please wait and try again after 15 minutes.
* **https://<sitename>.com ** will not work initially. **It will take 30-45 minutes** for the changes (**A records in DNS**) to reflect.
  * Add www.<sitename>.com
  * Enforce HTTPS should be selected
  * It takes 15-20 minutes for the changes to reflect.
* Most importantly, update build script to the following in package.json
```bash
    "build": "cp ./docs/CNAME ./CNAME_backup && BUILD_PATH='./docs' react-scripts build && cp ./CNAME_backup ./docs/CNAME && rm ./CNAME_backup",
```
* Also, add CNAME file to .gitiignore file to avoid it from being pushed to github.
  * .gitignore 
    * docs/CNAME
  * clear git cache
    * git rm -r --cached .
    * git add .
    * git commit -m "fixed gitignore files"
* Now, the custom domain should be working. 
* Note: It may take some time for the changes to reflect.

## Make app full screen on iphone after adding to home screen
* Add the following meta tag to index.html in public folder
  *  <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
  *  create manifest.json file in public folder
  ```json
  {
    "short_name": "Gen AI",
    "name": "Gen AI Studio",
    "icons": [
      {
        "src": "ai.avif"
      }
    ],
    "start_url": ".",
    "display": "standalone",
    "theme_color": "#000000",
    "background_color": "#ffffff"
  }
  ```
## Build and deploy the app
* npm run build
* git add, commit and push

## Firebase Firestore Database Security Rule
```yaml
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /todo/{document} {
      allow read, delete, update : if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /todo/{document} {
      allow write : if request.auth != null;
    }
    match /tasks/{document} {
      allow read, delete, update : if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /tasks/{document} {
      allow read,update : if request.auth != null && request.auth.uid in ['bTGBBpeYPmPJonItYpUOCYhdIlr1', 'qDzUX26K0dgtSMlN9PtCj6Q9L5J3', 'yvsWRZwjTQecvGap3pGXWNGHoTp2', 'lpwCpZkPk2h1ZWrESgkyXPUXEPQ2'];
    }
    match /tasks/{document} {
      allow write : if request.auth != null;
    }
    match /diagrams/{userId}/MyDiagrams/{document=**} {
      allow read, write, delete, update : if request.auth != null && request.auth.uid == userId;
    }
    match /diagrams/{document} {
      allow read, write : if request.auth != null;
    }
    match /genai/{userId}/MyGenAI/{document=**} {
      allow read, write, delete, update : if request.auth != null && request.auth.uid == userId;
    }
  }
} 
```

## Firebase Storage Security Rules for storing and accessing Images and Audio files
```yaml
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /user_data/{userId}/{allImages=**} {
      // Only allow authenticated users to read/write their own images
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```


### Audio Streaming on iPhone
