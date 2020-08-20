# webpack-dps-spa-plugin
单页面多路由骨架屏插件

<a name="AutoDpsPlugin"></a>

## AutoDpsPlugin
**Kind**: global class  
<a name="new_AutoDpsPlugin_new"></a>

### new AutoDpsPlugin(options)
自动渲染骨架屏插件


| Param | Description |
| --- | --- |
| options | 插件配置 |
| options.server | 渲染骨架屏本地服务配置 |
| options.server.port | 本地服务端口，默认从8000开始寻找 |
| options.server.proxy | 本地服务反向代理配置与devServer.proxy一致，如果为value为函数则为中间件，否则为http-proxy-middleware |
| options.insertEl | 骨架屏元素插入到html的父标签，默认 #skeleton |
| options.routeMode | 路由模式，默认 history |
| options.limit | 同时渲染骨架屏路由数量，默认 5 |
| options.staticDir | 打包输出目录（index.html输出目录），默认 项目根目录下的dist目录 |
| options.enableAutoSkeletonRoutes | 是否采用自动配置路由，必须使用 auto-routing 插件 |
| options.skeletonRoutes | 需要渲染的骨架屏路由配置，enableAutoSkeletonRoutes 为 false 可用 |

### options.skeletonRoutes
| Param | Description |
| --- | --- |
| name | 必须和路由定义的name一致 ｜
| path | 匹配当前路由的正则 ｜
| pathname | 访问路由的path地址，例如: /mn/demo ｜
| skeletonId | 骨架屏路由ID，唯一即可 ｜

## 使用
webpack chainWebpack 添加插件 
```js
config.plugin('AutoDpsPlugin')
    .use(AutoDpsPlugin, [{
      enableAutoSkeletonRoutes: true,
      limit: 5,
      server: {}
    }]);
```

### enableAutoSkeletonRoutes
添加 `vue-cli-auto-routing` 插件,在路由页面配置`<route>`块
```
<route>
{
    "meta": {
        "skeleton": true
    }
}
</route>
```
or
```
<route>
{
    "meta": {
        "skeleton": {
            "name": "home",
            "path": /^\/mn\/home/
            "pathname": "/mn/home",
            "skeletonId": "home"
        }
    }
}
</route>
```
