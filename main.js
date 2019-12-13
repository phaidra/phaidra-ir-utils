import fs from 'fs'
import qs from 'qs'
import axios from 'axios'
import config from './phaidra-ir'

function getSitemapXml(urls) {
  let str = '<?xml version="1.0" encoding="UTF-8"?>'
  str += "\n"
  str += '<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  str += "\n"
  for (let u of urls) {
    str += "  <url>\n"
    str += '    <loc>' + u.loc + "</loc>\n"
    if (u.lastmod) {
      str += '    <lastmod>' + u.lastmod + "</lastmod>\n"
    }
    str += "  </url>\n"
  }
  str += "</urlset>\n"
  return str
}

function getIndexfileXml(files) {
  let str = '<?xml version="1.0" encoding="UTF-8"?>'
  str += "\n"
  str += '<sitemapindex xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/siteindex.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  str += "\n"
  for (let f of files) {
    str += "  <sitemap>\n"
    str += '    <loc>' + f.loc + "</loc>\n"
    if (f.lastmod) {
      str += '    <lastmod>' + f.lastmod + "</lastmod>\n"
    }
    str += "  </sitemap>\n"
  }
  str += "</sitemapindex>\n"
  return str
}

async function createSitemap(){
  let params = {
    q: '*:*',
    fq: 'ispartof:\"' + config.ircollection + '\"',
    defType: 'edismax',
    wt: 'json',
    start: 0,
    rows: '99999',
    sort: 'modified desc'
  }
  let docs = []
  let total = 0
  try {
    let response = await axios.request({
      method: 'POST',
      url: config.solr + '/select',
      data: qs.stringify(params, { arrayFormat: 'repeat' }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    })
    docs = response.data.response.docs
    total = response.data.response.numFound
  } catch (error) {
    console.error(error)
  }

  let i = 0
  let indexFiles = []
  let indexFilesIdx = 1
  let urls = []
  let latestModified = '1970-01-01'
  for (let doc of docs) {
    i++
    
    if (doc.modified > latestModified) {
      latestModified = doc.modified
    }

    console.log('[' + i + '/' + total + '] processing title[' + doc.pid + '] latestModified[' + latestModified + ']')
    urls.push({ loc: 'https://' + config.baseurl + '/' + doc.pid, lastmod: doc.modified })

    if (urls.length > 10000) {
      let xml = getSitemapXml(urls)
      let filename = 'sitemap' + indexFilesIdx + '.xml'
      console.log('creating sitemap file ' + filename)
      fs.writeFileSync(config.sitemapfolder + filename, xml)
      indexFiles.push({ loc: 'https://' + config.baseurl + '/' + filename, lastmod: latestModified })
      indexFilesIdx++;
      latestModified = '1970-01-01'
      urls = []
    }
  }

  // rest
  if (urls.length > 1) {
    let xml = getSitemapXml(urls)
    let filename = 'sitemap' + indexFilesIdx + '.xml'
    console.log('creating sitemap file ' + filename)
    fs.writeFileSync(config.sitemapfolder + filename, xml)
    indexFiles.push({ loc: 'https://' + config.baseurl + '/sitemap' + indexFilesIdx + '.xml', lastmod: latestModified })
    indexFilesIdx++;
  }

  let idxXml = getIndexfileXml(indexFiles)
  console.log('creating sitemap index')
  fs.writeFileSync(config.sitemapfolder + 'sitemap.xml', idxXml)
}

console.log('started')
createSitemap().then(
  function() {
    console.log('finished')
  }
)
