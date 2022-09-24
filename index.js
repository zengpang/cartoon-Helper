#!/usr/bin/env node
const path = require('path');
const fetch = require('node-fetch');
const { Input } = require('enquirer');
const { Select } = require('enquirer');
const { NumberPrompt } = require('enquirer');
const cheerio = require('cheerio');
const fs = require('fs');
const isEmpty = str => (str == null || str == `` || str === `undefined`)
//js字符串转换位Unicode编码 
function utf8ToUnicode(text) {
    const code = text;
    let resultStr = "";
    for (var i = 0; i < code.length; i++) {
        const c = code.charCodeAt(i);
        resultStr += `&#x${c.toString(16).toUpperCase()};`;
    }
    return resultStr;
}
//Unicode编码转换为js字符串
function unicodeToUtf8(text) {
    const code = text.replace(/&#x(.{4});/g, "%u\$1");
    let resultStr = unescape(code);
    return resultStr;
}


let downFName = 'download';//下载文件夹名称
let cartoonDowns = new Map();//番剧下载信息
let episodeCount = 1; //获取最新集数
let downepisodeNumber = 1;//用户下载集数
let downCount = 1;//用户每集下载数量
function saveDownLink(cartoonName, downStr) {
    //检测下载文件夹是否存在
    if (!fs.existsSync(downFName)) {
        //无则创建文件夹
        fs.mkdirSync(downFName);
        fs.writeFileSync(path.join(process.cwd(), `${downFName}/${cartoonName}_BitComet.txt`), downStr, 'utf-8');
    }
    else {
        fs.writeFileSync(path.join(process.cwd(), `${downFName}/${cartoonName}_BitComet.txt`), downStr, 'utf-8');
    }
}
//获取番剧单集下载链接
function getDownLink(cartoonName, episodeNumber) {
    //下载链接字符串
    let downStr = "";
    let resultStr="";
    let numberKeys = Array.from(cartoonDowns.keys());
    let eCount=1;

    numberKeys.forEach(index => {

        let number = parseInt(index.split(':')[0]);
        if(number==-1)
        {
            number=1;
        }
        if(eCount>downCount)
        {
           
            return;
        }
        if (number == episodeNumber) {
            downStr+=`${cartoonDowns.get(index)}\n`;
            eCount++;
        }
    });
    
    if(downStr=="")
    {
        downStr="资源缺失\n";
    }
    resultStr=`————————————————————${cartoonName}第${episodeNumber}集————————————————————\n${downStr}\n`;
    return resultStr;
}

//获取番剧下载信息
async function getDownInfo(selectCartoon) {
    let url = selectCartoon.cartoonDPage;
    let cName=selectCartoon.cartoonName;
    let res = await fetch(url);
    let body = await res.text();
    let $ = cheerio.load(body);
    let downLinks=new Array();

    $('table.table.table-striped.tbl-border.fadeIn tbody tr td:nth-child(1)').each(function (i, elem) {
        let cartoonInfos = $(this).children(".magnet-link-wrap").text().match(/(- (\d)(\d)*)|(\[(\d)(\d)*\])/g);
        let downLink = $(this).children(".js-magnet.magnet-link").data('clipboard-text');
        
        //[ '[06]' ]
        if(downLink!=null)
        {
            
            //获取页面所有下载链接
            downLinks.push(downLink);
        }
        if (cartoonInfos != null && downLink != null) {
         
            let episodeNumber = cartoonInfos[0].replace(/(- )|((\[)|(\]))/g, "");
            //获取最新集数
            let number=parseInt(episodeNumber);
            if(number>episodeCount)
            {
                episodeCount=number;
            }
            //混入i值，保证键的独特性
            episodeNumber = `${number}:${i}`;
            cartoonDowns.set(episodeNumber, downLink);
        }
    });
   
    //当获取集数为空，但却有下载链接，则判断为该动漫为剧场版,不显示集数
    if(isEmpty(cartoonDowns.length)&&downLinks.length>0)
    {
        for(let i=0;i<downLinks.length;i++)
        {
              
              //-1表示为剧场版
              //混入i值，保证键的独特性
              cartoonDowns.set(`-1:${i}`, downLinks[i]);
        }
    }
    //获取下载集数
    const getECount = new NumberPrompt({
        name: 'EpisodeCount',
        message: `选择集数:请选择1到${episodeCount}(最新集数，超出边界的数字视为边界值)`
    });
    //获取每集下载数量
    const getDCount = new NumberPrompt({
        name: 'DownCount',
        message: `选择每集下载数量:请选择1以上的任意数字(超出每集资源边界值的数字视为边界值)`
    });
    getECount.run()
        .then(count => {
            if (count < 1 || count > episodeCount) {
                count = (count < 1 ? 1 : episodeCount);

            }
            downepisodeNumber = count;
            getDCount.run()
                .then(count => {
                    if (count < 1) 
                    {
                        count = 1;

                    }
                    downCount=count;
                    let downStrs="";
                    
                    for(let episodeNumber=1;episodeNumber<=downepisodeNumber;episodeNumber++)
                    {
                        downStrs+=getDownLink(cName,episodeNumber,downCount);
                    }
                    saveDownLink(cName,downStrs);
                });
        });

}
//获取番剧下载页面
async function getDownPage() {
    const getDPage = new Select({
        name: 'DownPage',
        message: '番剧下载页面',
        choices: cartoonsNames
    });
    getDPage.run()
        .then(selectName => {
            getDownInfo({ cartoonName: selectName, cartoonDPage: searchResult.get(selectName) })
        });

}

let searchName = '来自深渊';//搜索的番剧名称
let homeUrl = 'https://mikanani.me';
let linkStrs = new Array();//搜索番剧结果链接页面
let cartoonsNames = new Array();//搜索番剧结果名称
let searchResult = new Map();   //搜索番剧结果
//获取番剧信息
async function getCartoonInfo() {
    let url = `${homeUrl}/Home/Search?searchstr=${encodeURI(searchName)}`;
    let res = await fetch(url);
    let body = await res.text();
    let $ = cheerio.load(body);
    //搜索番剧结果链接 
    body.match(/\/Home\/Bangumi\/\d+/g).map(index => {
        linkStrs.push(homeUrl + (index.replace("'", "")));
    });
    let result=new Array();
    $('.an-info-group .an-text').each(function (i, elem) {
        result.push($(this).text());
     });
    if(isEmpty(result))
    {
        console.log(`没有名字为${searchName}的番剧，请输入正确名字`);
        return;
    }
    for (let i = 0; i < result.length; i++) {
        let cartoonsName =result[i];
        cartoonsNames.push(cartoonsName);
        searchResult.set(cartoonsName, linkStrs[i]);
    }


}
//入口函数
async function main() {
    const getSName = new Input({
        message: '输入番剧名称'
    });

    getSName.run()
        .then(cartoonStr => {
            searchName = cartoonStr; getCartoonInfo()
                .then(getDownPage);
        });

}
main();