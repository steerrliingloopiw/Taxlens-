import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform, Alert, Share, useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { D } from "./taxData";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: false, shouldSetBadge: false,
  }),
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TABS = [["calc", "Calculate", "🧮"], ["rem", "Reminders", "🔔"], ["hist", "History", "🕘"], ["me", "Profile", "👤"]];
const NOTES = {
  US: "Federal income tax only. State and local taxes are extra. Sales tax is a national average.",
  CA: "Blended federal and provincial estimate.",
  CH: "Income tax varies a lot by canton.",
  NL: "Social contributions are already inside the tax brackets.",
  IN: "New tax regime, no deductions. Provident fund is not counted.",
  GB: "England rates. Social contributions are National Insurance.",
  DE: "Church tax and solidarity surcharge are not included.",
  AE: "No personal income tax.",
  SA: "No personal income tax for residents.",
};

const flag = (k) => String.fromCodePoint(...k.split("").map((ch) => 127397 + ch.charCodeAt(0)));
const n = (s) => parseFloat(String(s).replace(/,/g, "")) || 0;

function fmtInput(s, indian) {
  const digits = String(s).replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (indian && digits.length > 3) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function money(v, cur, key) {
  try {
    return new Intl.NumberFormat(key === "IN" ? "en-IN" : "en", {
      style: "currency", currency: cur, maximumFractionDigits: 0,
    }).format(v);
  } catch (e) {
    return Math.round(v) + " " + cur;
  }
}

function calc(key, income) {
  const d = D[key];
  let tax = 0, lo = 0;
  d[2].forEach((b) => {
    if (income > lo) tax += ((Math.min(income, b[0]) - lo) * b[1]) / 100;
    lo = b[0];
  });
  const soc = (income * (key === "IN" ? 0 : d[6])) / 100;
  return { tax, soc, net: income - tax - soc };
}

async function ensureReady() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Tax reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let p = await Notifications.getPermissionsAsync();
  if (p.status !== "granted") p = await Notifications.requestPermissionsAsync();
  return p.status === "granted";
}

function nextDates(r) {
  const out = [], now = new Date();
  if (r.type === "monthly") {
    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, r.day, 9, 0, 0);
      if (d > now) out.push(d);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear() + i, r.month, r.day, 9, 0, 0);
      if (d > now) out.push(d);
    }
  }
  return out;
}

async function schedule(r, name) {
  const ids = [];
  for (const d of nextDates(r)) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: "TaxLens reminder", body: (name ? name + ", " : "") + r.label },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d, channelId: "reminders" },
    });
    ids.push(id);
  }
  return ids;
}

const Row = ({ c, label, value }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bd }}>
    <Text style={{ color: c.tx, fontSize: 15, flex: 1 }}>{label}</Text>
    <Text style={{ color: c.tx, fontSize: 15, fontWeight: "600" }}>{value}</Text>
  </View>
);
const Card = ({ c, title, children }) => (
  <View style={{ backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }}>
    <Text style={{ color: c.mut, fontSize: 13, marginBottom: 4 }}>{title}</Text>
    {children}
  </View>
);
const Field = ({ c, label, value, onChange, kb = "numeric" }) => (
  <View>
    <Text style={{ color: c.mut, fontSize: 13, marginTop: 12, marginBottom: 4 }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={kb}
      placeholderTextColor={c.mut}
      style={{ backgroundColor: c.card, color: c.tx, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 }}
    />
  </View>
);
const Tab = ({ c, label, on, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: on ? c.ac : c.bd, backgroundColor: on ? c.ac : c.card }}
  >
    <Text style={{ color: on ? c.on : c.tx, fontSize: 15, fontWeight: "600" }}>{label}</Text>
  </TouchableOpacity>
);
const Btn = ({ c, label, onPress, outline, flex }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flex: flex ? 1 : undefined, backgroundColor: outline ? "transparent" : c.ac, borderColor: c.ac, borderWidth: 1, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 }}
  >
    <Text style={{ color: outline ? c.ac : c.on, fontSize: 16, fontWeight: "700" }}>{label}</Text>
  </TouchableOpacity>
);
const TabBar = ({ c, tab, setTab }) => (
  <View style={{ flexDirection: "row", backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.bd, paddingBottom: 14, paddingTop: 8 }}>
    {TABS.map(([id, label, icon]) => (
      <TouchableOpacity key={id} onPress={() => setTab(id)} style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
        <Text style={{ fontSize: 12, marginTop: 2, color: tab === id ? c.ac : c.mut, fontWeight: tab === id ? "700" : "400" }}>{label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);
const Legend = ({ c, color, text }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14, marginTop: 4 }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 6 }} />
    <Text style={{ color: c.mut, fontSize: 12 }}>{text}</Text>
  </View>
);
const SplitBar = ({ c, net, tax, soc }) => {
  const nn = Math.max(net, 0), total = nn + tax + soc;
  if (total <= 0) return null;
  const seg = (v, col) => (v > 0 ? <View style={{ flex: v, backgroundColor: col }} /> : null);
  const pc = (v) => Math.round((v / total) * 100) + "%";
  return (
    <View>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", marginVertical: 10 }}>
        {seg(nn, "#10b981")}{seg(tax, "#f59e0b")}{seg(soc, "#3b82f6")}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Legend c={c} color="#10b981" text={"Take-home " + pc(nn)} />
        <Legend c={c} color="#f59e0b" text={"Income tax " + pc(tax)} />
        <Legend c={c} color="#3b82f6" text={"Social " + pc(soc)} />
      </View>
    </View>
  );
};

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = dark
    ? { bg: "#0f1115", card: "#1a1d23", tx: "#eef0f4", mut: "#9aa1ad", ac: "#34d3a0", bd: "#2b3038", on: "#0f1115" }
    : { bg: "#f4f6f9", card: "#ffffff", tx: "#14181f", mut: "#657080", ac: "#0e6f8a", bd: "#e1e5ec", on: "#ffffff" };

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("calc");
  const [reminders, setReminders] = useState([]);
  const [history, setHistory] = useState([]);
  const [nm, setNm] = useState("");
  const [key, setKey] = useState("US");
  const [inc, setInc] = useState("60,000");
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pr, setPr] = useState("100");
  const [bp, setBp] = useState("100,000");
  const [gn, setGn] = useState("10,000");
  const [rtype, setRtype] = useState("monthly");
  const [rd, setRd] = useState("1");
  const [rm, setRm] = useState("1");
  const [rl, setRl] = useState("Time to review or pay your tax.");

  useEffect(() => {
    (async () => {
      try {
        const p = JSON.parse((await AsyncStorage.getItem("profile")) || "null");
        const rs = JSON.parse((await AsyncStorage.getItem("reminders")) || "[]");
        const hs = JSON.parse((await AsyncStorage.getItem("history")) || "[]");
        if (p) {
          setProfile(p); setNm(p.name);
          if (D[p.key]) { setKey(p.key); setInc(fmtInput(p.income, p.key === "IN")); }
        }
        setHistory(hs);
        if (rs.length && (await ensureReady())) {
          for (const r of rs) {
            for (const id of r.ids || []) await Notifications.cancelScheduledNotificationAsync(id);
            r.ids = await schedule(r, p ? p.name : "");
          }
          await AsyncStorage.setItem("reminders", JSON.stringify(rs));
        }
        setReminders(rs);
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  const saveProfile = async () => {
    if (!nm.trim()) return Alert.alert("Please enter your name");
    const p = { name: nm.trim(), key, income: inc };
    await AsyncStorage.setItem("profile", JSON.stringify(p));
    setProfile(p);
    setTab("calc");
  };

  const d = D[key];
  const cur = d[1];
  const income = n(inc);
  const r = calc(key, income);
  const fm = (v) => money(v, cur, key);
  const price = n(pr);
  const indian = key === "IN";
  const filtered = Object.keys(D).filter((k) => D[k][0].toLowerCase().includes(q.toLowerCase().trim()));

  const saveResult = async () => {
    const e = { id: String(Date.now()), ts: Date.now(), key, income: inc, net: Math.round(r.net), tax: Math.round(r.tax), soc: Math.round(r.soc) };
    const next = [e, ...history].slice(0, 20);
    setHistory(next);
    await AsyncStorage.setItem("history", JSON.stringify(next));
    Alert.alert("Saved", "Added to your History tab.");
  };
  const shareResult = () => {
    Share.share({
      message:
        "TaxLens estimate: " + d[0] + "\n" +
        "Yearly income: " + fm(income) + "\n" +
        "Income tax: " + fm(r.tax) + "\n" +
        "Social contributions: " + fm(r.soc) + "\n" +
        "Take-home: " + fm(r.net) + "\n" +
        "(Rough estimate, not tax advice.)",
    });
  };
  const delHistory = async (id) => {
    const next = history.filter((x) => x.id !== id);
    setHistory(next);
    await AsyncStorage.setItem("history", JSON.stringify(next));
  };
  const clearHistory = () =>
    Alert.alert("Clear history?", "This removes all saved results.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => { setHistory([]); await AsyncStorage.setItem("history", "[]"); } },
    ]);

  const addReminder = async () => {
    const day = parseInt(rd, 10), month = parseInt(rm, 10) - 1;
    if (!(day >= 1 && day <= 28)) return Alert.alert("Day must be between 1 and 28");
    if (rtype === "yearly" && !(month >= 0 && month <= 11)) return Alert.alert("Month must be 1 to 12");
    if (!(await ensureReady())) return Alert.alert("Please allow notifications for TaxLens in your phone settings");
    const rem = { id: String(Date.now()), type: rtype, day, month: rtype === "yearly" ? month : 0, label: rl.trim() || "Time to review or pay your tax." };
    rem.ids = await schedule(rem, profile.name);
    const next = [...reminders, rem];
    setReminders(next);
    await AsyncStorage.setItem("reminders", JSON.stringify(next));
  };
  const delReminder = async (rem) => {
    for (const id of rem.ids || []) await Notifications.cancelScheduledNotificationAsync(id);
    const next = reminders.filter((x) => x.id !== rem.id);
    setReminders(next);
    await AsyncStorage.setItem("reminders", JSON.stringify(next));
  };

  const countryBtn = (
    <View>
      <Text style={{ color: c.mut, fontSize: 13, marginTop: 12, marginBottom: 4 }}>Country</Text>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12 }}>
        <Text style={{ color: c.tx, fontSize: 16 }}>{flag(key)}  {d[0]} ({cur})  ▾</Text>
      </TouchableOpacity>
    </View>
  );

  const picker = (
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48, padding: 16 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search country…"
          placeholderTextColor={c.mut}
          autoFocus
          style={{ backgroundColor: c.card, color: c.tx, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginTop: 16 }}
        />
        <FlatList
          data={filtered}
          keyExtractor={(k) => k}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => { setKey(item); setInc(fmtInput(inc, item === "IN")); setPr(fmtInput(pr, item === "IN")); setBp(fmtInput(bp, item === "IN")); setGn(fmtInput(gn, item === "IN")); setQ(""); setOpen(false); }}
              style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.bd }}
            >
              <Text style={{ color: c.tx, fontSize: 16 }}>{flag(item)}  {D[item][0]}{item === key ? "  ✓" : ""}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 14, alignItems: "center" }}>
          <Text style={{ color: c.ac, fontSize: 16, fontWeight: "600" }}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
        <StatusBar style={dark ? "light" : "dark"} />
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.tx, fontSize: 28, fontWeight: "800" }}>Welcome to TaxLens</Text>
          <Text style={{ color: c.mut, marginBottom: 8 }}>Set up your profile. It stays on this phone only.</Text>
          <Field c={c} label="Your name" value={nm} onChange={setNm} kb="default" />
          {countryBtn}
          <Field c={c} label="Yearly gross income" value={inc} onChange={(t) => setInc(fmtInput(t, indian))} />
          <Btn c={c} label="Continue" onPress={saveProfile} />
        </ScrollView>
        {picker}
      </View>
    );
  }

  const calcTab = (
    <View>
      <Text style={{ color: c.tx, fontSize: 26, fontWeight: "800" }}>Hi, {profile.name}</Text>
      <Text style={{ color: c.mut, marginBottom: 14 }}>Rough tax estimates for 30 countries</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Tab c={c} label="Quick" on={!full} onPress={() => setFull(false)} />
        <Tab c={c} label="Full" on={full} onPress={() => setFull(true)} />
      </View>
      {countryBtn}
      {NOTES[key] ? <Text style={{ color: c.mut, fontSize: 12, marginTop: 6 }}>{NOTES[key]}</Text> : null}
      <Field c={c} label="Yearly gross income" value={inc} onChange={(t) => setInc(fmtInput(t, indian))} />
      {full && <Field c={c} label="Purchase price (before VAT/sales tax)" value={pr} onChange={(t) => setPr(fmtInput(t, indian))} />}
      {full && <Field c={c} label="Business profit" value={bp} onChange={(t) => setBp(fmtInput(t, indian))} />}
      {full && <Field c={c} label="Investment gain" value={gn} onChange={(t) => setGn(fmtInput(t, indian))} />}

      <Card c={c} title="Take-home pay">
        <Text style={{ color: c.ac, fontSize: 30, fontWeight: "800" }}>{fm(r.net)}</Text>
        <SplitBar c={c} net={r.net} tax={r.tax} soc={r.soc} />
        <Row c={c} label="Income tax" value={fm(r.tax)} />
        <Row c={c} label="Social contributions" value={fm(r.soc)} />
        <Row c={c} label="Effective total rate" value={income ? (((r.tax + r.soc) / income) * 100).toFixed(1) + "%" : "0%"} />
      </Card>

      {full && (
        <Card c={c} title="Other taxes">
          <Row c={c} label={"VAT / sales tax (" + d[3] + "%)"} value={fm((price * d[3]) / 100)} />
          <Row c={c} label="Price with tax" value={fm(price * (1 + d[3] / 100))} />
          <Row c={c} label={"Corporate tax (" + d[4] + "%)"} value={fm((Math.max(n(bp), 0) * d[4]) / 100)} />
          <Row c={c} label={"Capital gains tax (" + d[5] + "%)"} value={fm((Math.max(n(gn), 0) * d[5]) / 100)} />
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn c={c} flex outline label="Save result" onPress={saveResult} />
        <Btn c={c} flex label="Share" onPress={shareResult} />
      </View>
      <Text style={{ color: c.mut, fontSize: 12, marginTop: 16 }}>
        Rates are approximate headline rates (about 2025), single filer, no deductions or credits. Regional, local and property taxes are not included. This is not tax advice.
      </Text>
    </View>
  );

  const remTab = (
    <View>
      <Text style={{ color: c.tx, fontSize: 26, fontWeight: "800" }}>Reminders</Text>
      <Text style={{ color: c.mut, marginBottom: 4 }}>Get a notification at 9:00 AM on the day you choose.</Text>
      <Card c={c} title="Your reminders">
        {reminders.length === 0 && <Text style={{ color: c.mut, fontSize: 14 }}>No reminders yet.</Text>}
        {reminders.map((x) => (
          <View key={x.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bd }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.tx, fontSize: 15, fontWeight: "600" }}>
                {x.type === "monthly" ? "Every month on day " + x.day : "Every year on " + MONTHS[x.month] + " " + x.day}
              </Text>
              <Text style={{ color: c.mut, fontSize: 13 }}>{x.label}</Text>
            </View>
            <TouchableOpacity onPress={() => delReminder(x)}>
              <Text style={{ color: "#e5484d", fontSize: 15, fontWeight: "600" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
      <Card c={c} title="Add a reminder">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tab c={c} label="Monthly" on={rtype === "monthly"} onPress={() => setRtype("monthly")} />
          <Tab c={c} label="Yearly" on={rtype === "yearly"} onPress={() => setRtype("yearly")} />
        </View>
        <Field c={c} label="Day of month (1 to 28)" value={rd} onChange={setRd} />
        {rtype === "yearly" && <Field c={c} label="Month (1 to 12)" value={rm} onChange={setRm} />}
        <Field c={c} label="Message" value={rl} onChange={setRl} kb="default" />
        <Btn c={c} label="Add reminder" onPress={addReminder} />
        <Text style={{ color: c.mut, fontSize: 12, marginTop: 10 }}>
          You choose the dates yourself. TaxLens does not know your real tax deadlines, so check them with your local tax office. Open the app every few months to keep reminders refreshed.
        </Text>
      </Card>
    </View>
  );

  const histTab = (
    <View>
      <Text style={{ color: c.tx, fontSize: 26, fontWeight: "800" }}>History</Text>
      <Text style={{ color: c.mut, marginBottom: 4 }}>Results you saved from the Calculate tab.</Text>
      <Card c={c} title="Saved results">
        {history.length === 0 && <Text style={{ color: c.mut, fontSize: 14 }}>Nothing saved yet.</Text>}
        {history.map((h) => (
          <View key={h.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bd }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.tx, fontSize: 15, fontWeight: "600" }}>{flag(h.key)}  {D[h.key] ? D[h.key][0] : h.key}</Text>
              <Text style={{ color: c.mut, fontSize: 13 }}>
                {new Date(h.ts).toLocaleDateString()} · income {h.income} · take-home {money(h.net, D[h.key][1], h.key)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => delHistory(h.id)}>
              <Text style={{ color: "#e5484d", fontSize: 15, fontWeight: "600" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
      {history.length > 0 && <Btn c={c} outline label="Clear all" onPress={clearHistory} />}
    </View>
  );

  const meTab = (
    <View>
      <Text style={{ color: c.tx, fontSize: 26, fontWeight: "800" }}>Profile</Text>
      <Field c={c} label="Your name" value={nm} onChange={setNm} kb="default" />
      {countryBtn}
      <Field c={c} label="Yearly gross income" value={inc} onChange={(t) => setInc(fmtInput(t, indian))} />
      <Btn c={c} label="Save profile" onPress={saveProfile} />
      <Card c={c} title="About TaxLens">
        <Row c={c} label="Version" value="1.0.0" />
        <Row c={c} label="Countries" value="30" />
        <Text style={{ color: c.mut, fontSize: 13, marginTop: 10 }}>
          TaxLens gives rough tax estimates for general information only. It is not tax, legal or financial advice. Rates change and personal situations differ, so check official sources or a qualified adviser before making decisions.
        </Text>
        <Text style={{ color: c.mut, fontSize: 13, marginTop: 10 }}>
          Privacy: your name, income, history and reminders are stored only on this phone. TaxLens does not have accounts or send your data anywhere.
        </Text>
      </Card>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {tab === "calc" && calcTab}
        {tab === "rem" && remTab}
        {tab === "hist" && histTab}
        {tab === "me" && meTab}
      </ScrollView>
      <TabBar c={c} tab={tab} setTab={setTab} />
      {picker}
    </View>
  );
}
