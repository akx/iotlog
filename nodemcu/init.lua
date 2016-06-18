dofile("config.lua")
wifi.setmode(wifi.STATION)
wifi.sleeptype(wifi.MODEM_SLEEP)
wifi.sta.config(Config.ap, Config.pw)
wifi.sta.autoconnect(1)
print(wifi.sta.getip())
ow_pin = 2

ow.setup(ow_pin)
function detect_ow_slave(ow_pin, family)
    ow.reset(ow_pin)
    local addr
    local count = 0
    repeat
      count = count + 1
      addr = ow.reset_search(ow_pin)
      addr = ow.search(ow_pin)
      tmr.wdclr()
      if addr ~= nil then
        if addr:byte(1) == family then
          return addr
        end
      end
    until (count > 100)
    return nil
end

function read_ds18s20_temp(pin, addr)
    local i, crc
    ow.reset(pin)
    ow.select(pin, addr)
    ow.write(pin, 0x44, 1) -- perform measurement
    tmr.delay(1000000)
    ow.reset(pin)
    ow.select(pin, addr)
    ow.write(pin, 0xBE, 1)
    local data = ''
    for i = 0, 8 do
      data = data .. string.char(ow.read(pin))
    end
    crc = ow.crc8(string.sub(data,1,8))
    if crc == data:byte(9) then
      local fpTemp = bit.bor(
        bit.lshift(data:byte(2), 11),
        bit.lshift(data:byte(1), 3)
      )
      -- 12-bit:
      fpTemp = bit.lshift(bit.band(fpTemp, 0xfff0), 3) - 16
      fpTemp = fpTemp + (16 - bit.lshift(data:byte(8), 7)) / 16
      local t = fpTemp * 0.0078125
      return t
    end                   
    tmr.wdclr()
    return nil
end

addr = detect_ow_slave(ow_pin, 0x10)


function ping(data)
    local conn = net.createConnection(net.TCP, 0)
    conn:on("receive", function(conn, payload) print(payload) end)
    conn:on("connection", function()
        data.node = Config.node
        data.uptime = tmr.time()
        local path = "/track?"
        for key, value in pairs(data) do
            if value ~= nil then
                path = path .. key .. "=" .. tostring(value) .. "&"
            end
        end
        print(path)
        conn:send("GET " .. path .. " HTTP/1.0\r\nConnection: close\r\n\r\n")
    end)
    conn:connect(Config.port, Config.host)
end

function t()
    local pin = 1
    local data = {}
    if addr ~= nil then
        data.dstemp = read_ds18s20_temp(ow_pin, addr)
    end    
    local status, temp, humi, temp_dec, humi_dec = dht.read(pin)
    if status == dht.OK then
        data.temp = temp
        data.humi = humi
    end
    ping(data)
end

t()
tmr.alarm(0, 30000, tmr.ALARM_AUTO, t)
