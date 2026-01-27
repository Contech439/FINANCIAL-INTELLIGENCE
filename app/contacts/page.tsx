'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';

export default function ContactsPage() {
  const supabase = createClient();

  // State Data
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('customer'); // customer, vendor, employee

  // State Form (Modal Sederhana)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Ambil Data Kontak
  const fetchContacts = async () => {
    setLoading(true);

    // Kita butuh ID Org dulu (cara cepat ambil org pertama user)
    // Di real app, kita simpan org_id di context/state global
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (members) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', members.organization_id)
        .eq('type', filterType)
        .order('created_at', { ascending: false });

      if (data) setContacts(data);
    }
    setLoading(false);
  };

  // Effect saat filter berubah
  useEffect(() => {
    fetchContacts();
  }, [filterType]);

  // Fungsi Tambah Kontak
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .single();

    if (members) {
      const { error } = await supabase.from('contacts').insert({
        organization_id: members.organization_id,
        name: newName,
        email: newEmail,
        type: filterType,
      });

      if (!error) {
        setIsFormOpen(false);
        setNewName('');
        setNewEmail('');
        fetchContacts(); // Refresh data
      } else {
        alert('Gagal menambah kontak: ' + error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Halaman */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-blue-600">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Daftar Kontak</h1>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + Tambah{' '}
          {filterType === 'customer'
            ? 'Pelanggan'
            : filterType === 'vendor'
            ? 'Vendor'
            : 'Karyawan'}
        </button>
      </header>

      <main className="p-8">
        {/* Tabs Filter */}
        <div className="flex space-x-4 mb-6 border-b pb-2">
          {['customer', 'vendor', 'employee'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`capitalize px-4 py-2 rounded-md text-sm font-medium ${
                filterType === type
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {type === 'customer'
                ? 'Pelanggan'
                : type === 'vendor'
                ? 'Vendor (Supplier)'
                : 'Karyawan'}
            </button>
          ))}
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email / Kontak
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    Belum ada data {filterType}.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {contact.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Aktif
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Form Tambah (Sederhana) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 capitalize">
              Tambah {filterType} Baru
            </h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nama Lengkap / Perusahaan
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full border rounded p-2"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  className="mt-1 w-full border rounded p-2"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
