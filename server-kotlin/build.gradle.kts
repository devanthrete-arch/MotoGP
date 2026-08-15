plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("io.ktor.plugin")
    application
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("com.autoflex.server.ApplicationKt")
}

dependencies {
    implementation(project(":shared"))
    implementation("io.ktor:ktor-server-core-jvm:3.5.1")
    implementation("io.ktor:ktor-server-netty-jvm:3.5.1")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:3.5.1")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:3.5.1")
    implementation("io.ktor:ktor-server-status-pages-jvm:3.5.1")
    implementation("org.xerial:sqlite-jdbc:3.50.3.0")
    implementation("ch.qos.logback:logback-classic:1.5.18")

    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host-jvm:3.5.1")
}
