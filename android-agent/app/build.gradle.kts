plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.prepaidpay.agent"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.prepaidpay.agent"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
        // Change this if you connect a custom domain later.
        buildConfigField("String", "API_BASE", "\"https://top-up-tally.lovable.app\"")
    }

    buildFeatures {
        buildConfig = true
        viewBinding = false
    }

    // Fixed key so every build has the same signature and can update in place.
    signingConfigs {
        getByName("debug") {
            storeFile = file("fixed-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
