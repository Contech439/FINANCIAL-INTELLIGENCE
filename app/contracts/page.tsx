'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';

export default function ContractsPage() {
  const supabase = createClient();

  // State
  const [contracts, setContracts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [orgName, setOrgName] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    contact_id: '',
    start_date: '',
    end_date: '',
    amount: '',
    address: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .single();
    if (!members) return;

    const orgId = members.organization_id;
    setOrgName(members.organizations?.name || 'Perusahaan Anda');

    // Ambil Data Kontrak
    const { data: contractsData } = await supabase
      .from('contracts')
      .select(`*, contacts(name, address)`)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (contractsData) setContracts(contractsData);

    // Ambil Data Vendor
    const { data: vendorData } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('type', 'vendor');

    if (vendorData) setContacts(vendorData);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();
      const orgId = members!.organization_id;

      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          organization_id: orgId,
          contact_id: formData.contact_id,
          title: formData.title,
          start_date: formData.start_date,
          end_date: formData.end_date,
          contract_value: formData.amount,
          contract_details: { object_address: formData.address },
          status: 'active',
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Auto Invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: orgId,
          contact_id: formData.contact_id,
          invoice_number: 'INV-' + Date.now().toString().slice(-6),
          date: new Date().toISOString(),
          due_date: formData.start_date,
          status: 'draft',
          type: 'PURCHASE',
          total_amount: formData.amount,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      await supabase.from('invoice_items').insert({
        organization_id: orgId,
        invoice_id: invoice.id,
        description: `Pembayaran Kontrak: ${formData.title}`,
        quantity: 1,
        unit_price: formData.amount,
        amount: formData.amount,
      });

      alert('Berhasil! Kontrak dibuat & Tagihan otomatis terbentuk.');
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // === FUNGSI FORMAT TANGGAL INDONESIA ===
  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // === TAMPILAN DOKUMEN LEGAL ===
  const renderDocument = (c: any) => {
    return (
      // PERHATIKAN: Saya menambahkan id="printable-document" di sini
      <div
        id="printable-document"
        className="bg-white p-12 text-gray-900 font-serif text-sm leading-relaxed shadow-lg max-w-3xl mx-auto border print:shadow-none print:border-none"
        style={{ minHeight: '297mm' }}
      >
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="font-bold text-xl uppercase tracking-wider">
            Surat Perjanjian Sewa Menyewa
          </h1>
          <p className="text-gray-500 italic mt-1">
            Nomor: {c.id.slice(0, 8).toUpperCase()}/LEG/
            {new Date().getFullYear()}
          </p>
        </div>

        {/* Isi Pembuka */}
        <div className="mb-6">
          <p>
            Pada hari ini,{' '}
            <strong>
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            , kami yang bertanda tangan di bawah ini:
          </p>
        </div>

        {/* Identitas Pihak */}
        <div className="ml-4 mb-6 space-y-4">
          <div>
            <p className="font-bold">1. PIHAK PERTAMA (PEMILIK)</p>
            <table className="w-full ml-4">
              <tbody>
                <tr>
                  <td className="w-32">Nama</td>
                  <td>: {c.contacts?.name}</td>
                </tr>
                <tr>
                  <td>Alamat</td>
                  <td>: {c.contacts?.address || 'Alamat belum dilengkapi'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="font-bold">2. PIHAK KEDUA (PENYEWA)</p>
            <table className="w-full ml-4">
              <tbody>
                <tr>
                  <td className="w-32">Nama</td>
                  <td>: {orgName}</td>
                </tr>
                <tr>
                  <td>Bertindak sbg</td>
                  <td>: Penyewa / Penanggung Jawab</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Isi Pasal */}
        <div className="mb-8 space-y-4 text-justify">
          <p>
            Kedua belah pihak sepakat untuk mengikatkan diri dalam perjanjian
            sewa menyewa dengan ketentuan sebagai berikut:
          </p>

          <ul className="list-decimal ml-5 space-y-2">
            <li>
              <strong>Objek Sewa:</strong>
              <br />
              {c.contract_details?.object_address || 'Sesuai kesepakatan'}
            </li>
            <li>
              <strong>Jangka Waktu:</strong>
              <br />
              Terhitung mulai tanggal{' '}
              <strong>{formatDateIndo(c.start_date)}</strong> sampai dengan{' '}
              <strong>{formatDateIndo(c.end_date)}</strong>.
            </li>
            <li>
              <strong>Nilai Sewa:</strong>
              <br />
              Sebesar{' '}
              <strong>
                Rp {parseInt(c.contract_value).toLocaleString('id-ID')}
              </strong>{' '}
              yang akan dibayarkan sesuai tagihan (Invoice) yang diterbitkan.
            </li>
          </ul>
        </div>

        {/* Penutup */}
        <p className="mb-12">
          Demikian surat perjanjian ini dibuat rangkap 2 (dua) bermeterai cukup
          dan memiliki kekuatan hukum yang sama.
        </p>

        {/* Kolom Tanda Tangan */}
        <div className="flex justify-between items-start mt-12 px-8">
          {/* Kiri: Pihak Pertama */}
          <div className="text-center w-1/3">
            <p className="mb-20 font-bold">PIHAK PERTAMA</p>
            <p className="font-bold underline uppercase">{c.contacts?.name}</p>
            <p className="text-xs text-gray-500">(Pemilik)</p>
          </div>

          {/* Kanan: Pihak Kedua + Meterai */}
          <div className="text-center w-1/3">
            <p className="mb-4 font-bold">PIHAK KEDUA</p>

            {/* Kotak Meterai */}
            <div className="border border-gray-400 text-gray-400 w-24 h-16 mx-auto mb-2 flex items-center justify-center text-[10px] bg-gray-50">
              Tempel Meterai
              <br />
              Rp 10.000
            </div>

            <p className="mt-2 font-bold underline uppercase">{orgName}</p>
            <p className="text-xs text-gray-500">(Penyewa)</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-blue-600">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Manajemen Kontrak</h1>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + Buat Kontrak Baru
        </button>
      </header>

      <main className="p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="bg-white p-6 rounded-lg shadow border hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-800">{c.title}</h3>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full uppercase">
                  {c.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                Vendor: <b>{c.contacts?.name}</b>
              </p>
              <p className="text-sm text-gray-600 mb-1">
                Periode: {formatDateIndo(c.start_date)} -{' '}
                {formatDateIndo(c.end_date)}
              </p>
              <p className="text-lg font-bold text-blue-600 mt-4">
                Rp {parseInt(c.contract_value).toLocaleString('id-ID')}
              </p>

              <div className="mt-4 pt-4 border-t flex gap-2">
                <button
                  onClick={() => setViewDoc(c)}
                  className="flex-1 bg-gray-800 text-white py-2 rounded text-sm hover:bg-gray-900 flex items-center justify-center gap-2"
                >
                  📄 Lihat & Print
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* MODAL VIEW DOCUMENT */}
        {viewDoc && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="relative w-full max-w-4xl my-8">
              {/* Tombol Aksi di Atas */}
              <div className="flex justify-end gap-2 mb-4 sticky top-0 z-10">
                <button
                  onClick={() => window.print()}
                  className="bg-white text-gray-800 px-4 py-2 rounded shadow font-bold hover:bg-gray-100"
                >
                  🖨️ Print PDF
                </button>
                <button
                  onClick={() => setViewDoc(null)}
                  className="bg-red-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-red-700"
                >
                  Tutup (X)
                </button>
              </div>

              {/* Area Kertas Putih */}
              {renderDocument(viewDoc)}
            </div>
          </div>
        )}

        {/* MODAL FORM (Tetap Sama) */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Buat Kontrak Sewa</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Judul Kontrak</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded p-2"
                    placeholder="Sewa Ruko Cabang A"
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Vendor / Pemilik
                  </label>
                  <select
                    required
                    className="w-full border rounded p-2"
                    onChange={(e) =>
                      setFormData({ ...formData, contact_id: e.target.value })
                    }
                  >
                    <option value="">-- Pilih Vendor --</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Tanggal Mulai</label>
                    <input
                      type="date"
                      required
                      className="w-full border rounded p-2"
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full border rounded p-2"
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Nilai Kontrak (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full border rounded p-2"
                    placeholder="10000000"
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Alamat Objek Sewa
                  </label>
                  <textarea
                    className="w-full border rounded p-2"
                    rows={3}
                    placeholder="Jl. Sudirman No. 1..."
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  ></textarea>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-gray-600"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Simpan & Generate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* STYLE KHUSUS PRINT */}
      {/* STYLE KHUSUS PRINT - YANG DIPERBAIKI */}
      {/* STYLE KHUSUS PRINT - PERBAIKAN V2 */}
      <style jsx global>{`
        @media print {
            /* 1. Sembunyikan SELURUH BODY browser */
            body {
                visibility: hidden;
                background: white;
            }

            /* 2. Tarik keluar elemen #printable-document agar tetap tampil */
            #printable-document {
                visibility: visible !important;
                position: fixed !important; /* Gunakan Fixed agar lepas dari layout web */
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                z-index: 99999 !important; /* Pastikan dia di lapisan paling atas */
                box-shadow: none !important;
                border: none !important;
            }

            /* 3. Pastikan semua teks di dalam dokumen terlihat jelas */
            #printable-document * {
                visibility: visible !important;
                color: black !important; /* Paksa teks jadi hitam pekat */
            }

            /* 4. Sembunyikan tombol print/close jika masih membandel */
            button {
                display: none !important;
            }
            
            /* 5. Hilangkan scrollbar */
            ::-webkit-scrollbar {
                display: none;
            }
        }
      `}</style>
    </div>
  );
}
