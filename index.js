#!/usr/bin/env node
const path = require('path');
const fetch = require('node-fetch');
const { Input } = require('enquirer');
const { Select } = require('enquirer');
const { MultiSelect } = require('enquirer');
const { NumberPrompt } = require('enquirer');
const cheerio = require('cheerio');
const fs = require('fs');
const isEmpty = str => (str == null || str == `` || str === `undefined`);//判断是否为空
let downFName = 'download';//下载文件夹名称
let cartoonDowns = new Map();//番剧下载信息（包括下载链接，番剧集数）
let episodeCount = 1; //获取最新集数
let downepisodeNumber = 1;//用户下载集数
let downCount = 1;//用户每集下载数量
let downfactor = 1;//下载因子
//通过链接获取访问页面HTML内容
async function getpageContent(url)
{
    let res = await fetch(url);
    return await res.text();
}
//保存下载链接
function saveDownLink(cartoonName, downStr) {
    //检测下载文件夹是否存在
    if (!fs.existsSync(downFName)) {
        //无则创建文件夹
        fs.mkdirSync(downFName);
        //写入文件
        fs.writeFileSync(path.join(process.cwd(), `${downFName}/${cartoonName}_BitComet.txt`), downStr, 'utf-8');
    }
    else {
         //写入文件
        fs.writeFileSync(path.join(process.cwd(), `${downFName}/${cartoonName}_BitComet.txt`), downStr, 'utf-8');
    }
}
//获取番剧单集下载链接
function getDownLink(cartoonName, episodeNumber) {
    //下载链接字符串
    let downStr = "";
    //返回字符串
    let resultStr = "";
    let numberKeys = Array.from(cartoonDowns.keys());
    let eCount = 1;
    //遍历番剧下载信息键值对数组
    numberKeys.forEach(index => {
        //根据键格式解析出番剧集数
        let number = parseInt(index.split(':')[0]);
        //如果番剧集数为-1，即
        if (number == -1) {
            number = 1;
        }
        if (eCount > downCount) {

            return;
        }
        if (number == episodeNumber) {

            downStr += `${cartoonDowns.get(index)}\n`;
            eCount++;
        }
    });
    //
    if (downStr == "") {
        downStr = "资源缺失\n";
    }
    resultStr = `————————————————————${cartoonName}第${episodeNumber}集————————————————————\n${downStr}\n`;
    return resultStr;
}
//获取单个字幕组资源链接
async function getDownLinks(url, subtitleName) {
    let body =await getpageContent(url);
    let $ = cheerio.load(body);
    let downLinks = new Array();
    let cartoonInfoCount = 0;
    $('table.table.table-striped.tbl-border.fadeIn tbody tr td:nth-child(1)').each(function (i, elem) {
        //根据正则表达式获取符合集数格式的字符串集合
        let cartoonInfo = $(this).children(".magnet-link-wrap").text().match(/(- (\d)(\d)*)|((\[(\d)(\d)*\])|(【(\d)(\d)*】))/g);
        let downLink = $(this).children(".js-magnet.magnet-link").data('clipboard-text');
        //[ '[06]' ]
        if (downLink != null) {

            //获取页面所有下载链接
            downLinks.push(downLink);
        }
        if (cartoonInfo != null && downLink != null) {
            
            let episodeNumber = cartoonInfo[0].replace(/(- )|((\[)|(\])|(【)|(】))/g, "");
            //获取最新集数
            let number = parseInt(episodeNumber);
            if (number > episodeCount) {
                episodeCount = number;
            }
            //混入因子值，保证键的独特性,键的格式为 番剧集数
            episodeNumber = `${number}:${downfactor}`;

            cartoonDowns.set(episodeNumber, downLink);
             //混合因子+1
            downfactor++;
            cartoonInfoCount++;
        }

    });
    //当获取集数为空，但却有下载链接，则判断为该动漫为剧场版,不显示集数
    if (cartoonInfoCount == 0 && downLinks.length > 0) {
        for (let i = 0; i < downLinks.length; i++) {

            //-1表示为剧场版
            //混入i值，保证键的独特性
            cartoonDowns.set(`-1:${downfactor}`, downLinks[i]);
            //混合因子+1
            downfactor++;
        }
    }
    console.log(`正在获取${subtitleName}资源`);
    await new Promise(resolve => setTimeout(resolve, 200));
}
//获取番剧下载资源
async function getDownResource(subtitleNames, subtitleMaps) {
    for (let index = 0; index < subtitleNames.length; index++) {
        //获取番剧字幕组名称
        let subtitleName = subtitleNames[index];
        //根据名称获取番剧字幕组资源链接
        let url = subtitleMaps.get(subtitleName);
        await getDownLinks(url, subtitleName);
    }
    console.log("资源获取完毕");
}


//链接处理
function Linkhandle(cName) {
    console.log("最大集数为" + episodeCount);
    //获取下载集数
    const getECount = new NumberPrompt({
        name: 'EpisodeCount',
        message: `输入下载集数:请输入1到${episodeCount}(最新集数，超出边界的数字视为边界值)`
    });
    //获取每集下载数量
    const getDCount = new NumberPrompt({
        name: 'EpisodeDount',
        message: `选择每集下载数量:(至少1集，最多集数受资源数量，超出边界的数字视为边界值)`
    });
    //启动下载集数获取菜单
    getECount.run()
        .then(
            count => {
                //检测用户输入每集下载次数是否小于1
                if (count < 1 || count > episodeCount) {
                    count = (count < 1 ? 1 : episodeCount);
                }
                downepisodeNumber = count;
                getDCount.run()
                    .then(count => {
                        //检测用户输入每集下载次数是否小于1
                        if (count < 1) {
                            //如果是则设置为1
                            count = 1;
                        }
                        downCount = count;
                        let downStrs = "";
                        for (let episodeNumber = 1; episodeNumber <= downepisodeNumber; episodeNumber++) {
                            downStrs += getDownLink(cName, episodeNumber);
                        }
                        //保存链接
                        saveDownLink(cName, downStrs);
                    })
            }
        );
}
//获取番剧下载信息
async function getDownInfo(selectCartoon) {
    //番剧信息页面链接
    let url = selectCartoon.cartoonDPage;
    //番剧名称
    let cName = selectCartoon.cartoonName;
    //番剧id
    let cid = selectCartoon.cartoonId.toString();
    //获取页面HTML字符串
    let body =await getpageContent(url);
    // fs.writeFileSync(path.join(process.cwd(), `${downFName}/test_1.html`), body, 'utf-8');
    let $ = cheerio.load(body);
    //.leftbar-item span a.subgroup-name
    //番剧格式 https://mikanani.me/Home/ExpandEpisodeTable?bangumiId=2775&subtitleGroupId=213&take=65
    //剧场版格式 https://mikanani.me/Home/ExpandEpisodeTable?bangumiId=2239&subtitleGroupId=552&take=65

    let subtitleInfos = new Array();//字幕组信息
    let subtitleMaps = new Map();
    $('.leftbar-item span a.subgroup-name').each(function (i, elem) {
        let subtitlename = $(this).text();//字幕组名称
        let subtitleid = $(this).data('anchor').replace('#', '');//字幕组id
        let subtitlepage = `${homeUrl}/Home/ExpandEpisodeTable?bangumiId=${cid}&subtitleGroupId=${subtitleid}&take=65`;//字幕组资源页面链接
        let subtitleInfo = { name: subtitlename, value: subtitlepage };//字幕组对象
        subtitleInfos.push(subtitleInfo);
        subtitleMaps.set(subtitlename, subtitlepage);
    });
    //获取番剧资源来源
    const getDSource = new MultiSelect({
        name: 'DownSource',
        message: `选择番剧资源来源处(可多选，多选则从多个来源获取资源,空格键选择，回车键确认)`,
        limit: subtitleInfos.length,
        choices: subtitleInfos,

    });
    getDSource.run()
        .then((names) => {
            getDownResource(names, subtitleMaps)
                .then(() => { Linkhandle(cName) });
        });

}
//获取番剧下载页面
async function getDownPage() {
    const getDPage = new Select({
        name: 'DownPage',
        message: '番剧下载页面',
        choices: cartoonsNames
    });
    //用户根据名称选择欲下载的番剧,根据选择番剧名获取页面url
    getDPage.run()
        .then(selectName => {
            getDownInfo({ cartoonName: selectName, cartoonDPage: searchResult.get(selectName), cartoonId: searchResult.get(selectName).replace(`${homeUrl}/Home/Bangumi/`, '') })
        });

}

let searchName = '来自深渊';//搜索的番剧名称
let homeUrl = 'https://mikanani.me';
let linkStrs = new Array();//搜索番剧结果链接页面
let cartoonsNames = new Array();//搜索番剧结果名称
let searchResult = new Map();   //搜索番剧结果
//获取番剧信息
async function getCartoonInfo() {
    //根据番剧名称拼接url
    let url = `${homeUrl}/Home/Search?searchstr=${encodeURI(searchName)}`;
    let body =await getpageContent(url);
    let $ = cheerio.load(body);
    //搜索番剧结果链接 
    body.match(/\/Home\/Bangumi\/\d+/g).map(index => {
        linkStrs.push(homeUrl + (index.replace("'", "")));
    });
    //番剧名称搜索结果数组
    let result = new Array();
    //通过选择器字符串获取所有装载番剧名称的元素并遍历
    $('.an-info-group .an-text').each(function (i, elem) {
        //获取装载番剧名称的元素文本,并添加至番剧名称搜索结果数组
        result.push($(this).text());
    });
    //番剧名称搜索结果数组为空
    if (isEmpty(result)) {
        console.log(`没有名字为${searchName}的番剧，请输入正确名字`);
        return;
    }
    //遍历番剧名称搜索结果数组
    for (let i = 0; i < result.length; i++) {
        let cartoonsName = result[i];
        cartoonsNames.push(cartoonsName);
        //以名称为键，链接为值添加至搜索番剧结果键值对数组中
        searchResult.set(cartoonsName, linkStrs[i]);
    }
}
//入口函数
async function main() {
    //输入番剧名称
    const getSName = new Input({
        message: '输入番剧名称'
    });
    //运行输入菜单
    getSName.run()
        .then(cartoonStr => {
            //获取番剧名称，并获取番剧信息
            searchName = cartoonStr; getCartoonInfo()
                .then(getDownPage);//获取番剧信息完成之后，获取番剧下载页面信息
        });

}
main();