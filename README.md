# Generative AI Studio
# Lessons Learned - React Hooks
** useEffect **
* useEffect was getting triggered twice, once for searchQuery and once for limit. I had to use if condition to stop it from happening.
* Adding dependencies to useEffect will execute the code whenever dependencies change.
** useState **
* use this React hook to assign values


## adding custom domain www.genai-all.com
* Go to settings -> Pages -> Custom domain -> Add custom domain
  * Add www.genai-all.com
  * Enforce HTTPS should be selected
  * It takes 15-20 minutes for the changes to reflect.
* Go to domain provider godaddy.com and add **CNAME** record with value (subdomain like **www.genai-all.com**)
  * CNAME: www -> sharath.github.io
* Go to domain provider godaddy.com and add **A** record with values (Apex domain like **genai-all.com without www**) 
  * A: @ -> 185.199.108.153
  * A: @ -> 185.199.109.153
  * A: @ -> 185.199.110.153
  * A: @ -> 185.199.111.153
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
