using System;
using System.Diagnostics;
using System.Reflection;
using Aki.Reflection.Patching;
using BepInEx;
using BepInEx.Configuration;
using EFT;
using UnityEngine;
using VersionChecker;

namespace DoorBreach
{
    [BepInPlugin("com.nektoNick.BackdoorBandit", "nektoNick.BackdoorBandit", DoorBreachPlugin.PluginVarsion)]
    [BepInDependency("com.spt-aki.core", "3.6.1")]
    public class DoorBreachPlugin : BaseUnityPlugin
    {
        public const String PluginVarsion = "1.0.1";

        public static ConfigEntry<float> ObjectHP;
        public static ConfigEntry<float> NonLockHitDmgMult;
        public static ConfigEntry<float> LockHitDmgMult;
        public static ConfigEntry<float> ThinWoodProtectionMult;
        public static ConfigEntry<float> PlasticProtectionMult;
        public static ConfigEntry<float> ThickWoodProtectionMult;
        public static ConfigEntry<float> ThinMetalProtectionMult;
        public static ConfigEntry<float> ThickMetalProtectionMult;
        public static ConfigEntry<float> MeeleWeaponDamageMult;

        public static int interactiveLayer;
        private void Awake()
        {
            CheckEftVersion();

            ObjectHP = Config.Bind("1. HP", "ObjectHP", 200F);
            NonLockHitDmgMult = Config.Bind("2. Lock Hits", "NonLockHitDmgMult", 0.5F);
            LockHitDmgMult = Config.Bind("2. Lock Hits", "LockHitDmgMult", 2F);
            ThinWoodProtectionMult = Config.Bind("3. Material Protection", "ThinWoodProtectionMult", 3F);
            PlasticProtectionMult = Config.Bind("3. Material Protection", "PlasticProtectionMult", 3F);
            ThickWoodProtectionMult = Config.Bind("3. Material Protection", "ThickWoodProtectionMult", 5F);
            ThinMetalProtectionMult = Config.Bind("3. Material Protection", "ThinMetalProtectionMult", 10F);
            ThickMetalProtectionMult = Config.Bind("3. Material Protection", "ThickMetalProtectionMult", 15F);
            MeeleWeaponDamageMult = Config.Bind("4. Specific Weapon", "MeeleWeaponDamageMult", 5F);

            new NewGamePatch().Enable();
            new BackdoorBandit.ApplyHit().Enable();
        }

        private void CheckEftVersion()
        {
            // Make sure the version of EFT being run is the correct version
            int currentVersion = FileVersionInfo.GetVersionInfo(BepInEx.Paths.ExecutablePath).FilePrivatePart;
            int buildVersion = TarkovVersion.BuildVersion;
            if (currentVersion != buildVersion)
            {
                Logger.LogError($"ERROR: This version of {Info.Metadata.Name} v{Info.Metadata.Version} was built for Tarkov {buildVersion}, but you are running {currentVersion}. Please download the correct plugin version.");
                EFT.UI.ConsoleScreen.LogError($"ERROR: This version of {Info.Metadata.Name} v{Info.Metadata.Version} was built for Tarkov {buildVersion}, but you are running {currentVersion}. Please download the correct plugin version.");
                throw new Exception($"Invalid EFT Version ({currentVersion} != {buildVersion})");
            }
        }
    }

    //re-initializes each new game
    internal class NewGamePatch : ModulePatch
    {
        protected override MethodBase GetTargetMethod() => typeof(GameWorld).GetMethod(nameof(GameWorld.OnGameStarted));

        [PatchPrefix]
        public static void PatchPrefix()
        {
            //stolen from drakiaxyz - thanks
            DoorBreachPlugin.interactiveLayer = LayerMask.NameToLayer("Interactive");

            BackdoorBandit.DoorBreachComponent.Enable();
        }
    }
}
