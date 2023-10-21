# ShootTheDoor
## Build
To build this project change value of `SptFolder` in `ShootTheDoor.csproj` from `C:\Games\SPT_3_7_1` to your path to SPT folder

## Description
I steal the idea from dvize's BackdoorBandit mod and make all weapons suitable for opening door(Something like dvize's `PlebMode`).
I made it because, I think some weapon should be more effective than another one and metal doors should take more shoots than wooden doors.
So, I rewrite the core part of client side mod and remove the server side mod(since you don't need specific bullets anymore).

But the main idea stays the same. This mod allow you to open locked doors(and containers like safes. and car doors) by shooting into them. Like in real life.

## Install 
Place DLL file into %SPT%/BepInEx/plugins

## Usage
- Take your gun.
- Shoot to the door
    - Aim for the door lock for more damage.
- When door HP drops to zero door will open.
- Also try to use meele weapon for this!

## Config
- You can change some values in BepInEx config menu (F12):
    - HP - More HP - more shoots to break the lock
        - ObjectHP - Same for doors, containers and car doors
    - Lock Hits - lock hits have increased damage, non-lock hits have decreased damage
        - NonLockHitDmgMult
        - LockHitDmgMult
    - Material Protection - some material should take more shoots. This is just a damage divider but you can consider this as door armor class.
        - ThinWoodProtectionMult
        - PlasticProtectionMult
        - ThickWoodProtectionMult
        - ThinMetalProtectionMult
        - ThickMetalProtectionMult
    - Specific Weapon - make certain types of weapon more effective against doors
        - MeeleWeaponDamageMult - because crowbar is effective in real life

## Credits
Original mod: 
- github - https://github.com/dvize/BackdoorBandit
- SPT - https://hub.sp-tarkov.com/files/file/1154-backdoor-bandit-bb/#overview