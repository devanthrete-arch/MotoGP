package com.autoflex.server

import com.autoflex.shared.PostDraft
import java.security.SecureRandom

fun seed(database: AutoflexDatabase) {
    if (database.stats().first > 0) return
    val examples = listOf(
        PostDraft(
            title = "40,000 km review: Tata Nexon diesel after two monsoons",
            author = "RevMatchRohan",
            brand = "Tata",
            topic = "Ownership Review",
            knowledgeLabel = "Review",
            model = "Nexon",
            variant = "XZ+ Diesel MT",
            city = "Pune",
            odometerKm = 40_200,
            cover = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200",
            body = "The car has done Pune-Bangalore twice, weekly Hinjewadi traffic, and one slushy Konkan run.\n\nWhat still feels strong: highway stability, diesel torque, and seat comfort. What still irritates: rear camera quality at night and the occasional dashboard buzz over broken patches.\n\nService spend is predictable so far. The 30k service with brake cleaning was about Rs 9,800 at the authorised centre.",
        ),
        PostDraft(
            title = "Known issue: Nexon front suspension clunk on slow turns",
            author = "TorqueTara",
            brand = "Tata",
            topic = "Troubleshooting",
            knowledgeLabel = "Known issue",
            model = "Nexon",
            variant = "XZ+ Diesel MT",
            city = "Mumbai",
            odometerKm = 31_000,
            body = "On slow parking-lot turns I started hearing a single clunk from the left front. It was easiest to reproduce while reversing with some steering lock.\n\nWorkshop first blamed loose tools in the boot. Actual suspect after inspection: worn stabiliser link and dry strut top mount. Ask them to inspect on a ramp while turning the steering, not only during a road test.",
        ),
        PostDraft(
            title = "Fix: Nexon clunk reduced after stabiliser link replacement",
            author = "GreasePencil",
            brand = "Tata",
            topic = "DIY & Optimization",
            knowledgeLabel = "Fix",
            model = "Nexon",
            variant = "XZ+ Diesel MT",
            city = "Mumbai",
            odometerKm = 32_100,
            body = "Replacing the left stabiliser link removed most of the low-speed clunk. The remaining faint knock went away after the strut top mount was cleaned and greased.\n\nParts plus labour came to Rs 2,450 outside warranty. If your sound happens only on full-lock turns, check steering rack mounting before ordering parts.",
        ),
        PostDraft(
            title = "Cost note: Creta 1.5 turbo 20k service bill",
            author = "GearHeadGita",
            brand = "Hyundai",
            topic = "Ownership Review",
            knowledgeLabel = "Cost note",
            model = "Creta",
            variant = "SX(O) Turbo DCT",
            city = "Delhi NCR",
            odometerKm = 20_400,
            body = "20k paid service in Gurugram was Rs 12,760 including synthetic oil, oil filter, air filter, AC filter, wheel alignment, balancing, and labour.\n\nThe advisor pushed throttle-body cleaning; I skipped it because idle was stable and there was no hesitation. DCT behaviour remains smooth in traffic if you avoid creeping half-brake for long stretches.",
        ),
        PostDraft(
            title = "Creta turbo DCT in Delhi traffic: what surprised me",
            author = "ClutchlessKabir",
            brand = "Hyundai",
            topic = "Ownership Review",
            knowledgeLabel = "Review",
            model = "Creta",
            variant = "SX(O) Turbo DCT",
            city = "Delhi NCR",
            odometerKm = 12_800,
            body = "I expected the turbo-DCT combo to feel nervous in crawling traffic, but it has been calmer than older DCTs. The trick is to leave a small gap and let the car roll instead of inching every second.\n\nMileage: 8-9 km/l in central Delhi, 14-15 km/l on relaxed highway runs. The Bose system is genuinely good; the horn is still very Hyundai.",
        ),
        PostDraft(
            title = "XUV700 diesel: highway family review after 28,000 km",
            author = "DieselDon",
            brand = "Mahindra",
            topic = "Ownership Review",
            knowledgeLabel = "Review",
            model = "XUV700",
            variant = "AX7L Diesel AT",
            city = "Bengaluru",
            odometerKm = 28_000,
            body = "This is still the easiest car in our family for long-distance work. ADAS is useful on sane highways, the diesel has a deep reserve, and the second row is excellent for parents.\n\nTwo irritants: infotainment rebooted twice during a Coorg run, and the piano-black trim looks tired already. Service experience has been good, but book early before holiday weekends.",
        ),
        PostDraft(
            title = "Travelogue: Bengaluru to Coorg in the XUV700",
            author = "MapPocketMeera",
            brand = "Mahindra",
            topic = "Ownership Review",
            knowledgeLabel = "Travelogue",
            model = "XUV700",
            variant = "AX7L Diesel AT",
            city = "Bengaluru",
            odometerKm = 26_500,
            body = "Route: Bengaluru - Mysuru expressway - Hunsur - Kushalnagar - Madikeri. We left at 5:20 AM and reached before lunch with one breakfast stop.\n\nThe Mysuru expressway is effortless, but the Hunsur stretch needs patience around buses and two-wheelers. Hill climb after Kushalnagar was comfortable in Zip mode. Diesel tank range meant no fuel stop anxiety.",
        ),
        PostDraft(
            title = "Honda City CVT: why I still recommend it to calm drivers",
            author = "SedanSamar",
            brand = "Honda",
            topic = "Buying Advice",
            knowledgeLabel = "Owner note",
            model = "City",
            variant = "ZX CVT",
            city = "Chennai",
            odometerKm = 18_600,
            body = "If your usage is office, airport, family dinners, and occasional highway, the City CVT still makes a lot of sense. It is low drama, easy to place, and the rear seat is the party trick.\n\nNot for you if you want SUV stance, ventilated seats, or punchy turbo shove. Very much for you if your parents ride in the back often.",
        ),
    )
    val ids = examples.map { database.createPost(it, randomToken()) }
    database.addComment(ids[0], "PuneCommuter", "This is exactly the long-term detail I wanted before booking a test drive.")
    database.addComment(ids[2], "WorkshopWatch", "Confirmed on my car too. Stabiliser link was the culprit.")
    database.addComment(ids[5], "HighwayDad", "ADAS note is useful. Please add tyre wear after 40k if possible.")
    database.confirmFix(ids[2], randomToken())
    database.confirmFix(ids[2], randomToken())
    database.addQualitySignal(ids[0], randomToken(), "helpful")
    database.addQualitySignal(ids[2], randomToken(), "helpful")
    database.addQualitySignal(ids[3], randomToken(), "helpful")
    database.setPinned(ids[2], true)
}

private fun randomToken() = ByteArray(24).also(SecureRandom()::nextBytes).toHex()
private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
