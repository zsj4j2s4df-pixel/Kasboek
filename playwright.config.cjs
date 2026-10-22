const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',testMatch:'*.spec.cjs',workers:1,timeout:45000,use:{baseURL:'http://localhost:4173',headless:true},webServer:{command:'node scripts/test-server.mjs',url:'http://localhost:4173',reuseExistingServer:false}});
